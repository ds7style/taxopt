/**
 * tax_rules.js
 *
 * TaxOpt 계산 엔진 v0.2.0 — 세법 규칙 데이터 모듈
 *
 * 책임:
 *   1) 양도소득세 계산에 필요한 "규칙 데이터(상수·룩업 테이블)"를 단일 소스로 보유.
 *   2) 룩업 함수(findBracket·findHoldingRate·findResidenceRate) 제공.
 *   3) 데이터 자체의 무결성 자체검증(selfTest).
 *
 * 비책임:
 *   - 양도차익·과세표준 등 13단계 파이프라인 계산 (→ tax_engine.js)
 *   - 화면 DOM 접근
 *   - 입력 정규화·검증 (→ input_collector.js)
 *
 * 노출:
 *   window.TaxOpt.taxRules
 *
 * 근거 법령:
 *   - 소득세법 [법률 제21065호, 시행 2026-01-02]
 *   - 소득세법 시행령 [대통령령 제36129호, 시행 2026-03-01]
 *   - 지방세법 제103조의3
 *
 * 적용 전제 (v0.2.0):
 *   - 양도일 ≥ 2026-05-10 (중과 유예 종료 후)
 *   - 단독명의, 매매취득, 등기자산
 *   - v0.2 추가: 1세대1주택 비과세·고가주택 안분·장특공 표 1·표 2 룩업 지원
 *
 * 참조 문서:
 *   - 모듈 스펙:    docs/v0.2/modules/tax_rules.md v0.2.0 (단일 진본)
 *   - 작업지시서:   docs/05_code_work_orders/03_tax_rules_v0_2.md
 *   - 명세서:       docs/v0.2/01_calc_engine_spec.md v0.2.1
 *   - 골든셋:       docs/v0.2/06_test_cases.md v0.2.1
 *   - 의사결정:     docs/99_decision_log.md (#5 강화, #9 v9, #11)
 *
 * §0-1 법령 개정 대응 아키텍처 (의사결정 #5 강화):
 *   (1) 단일 소스         — 법령 명시 숫자는 본 모듈 한 곳에만 둔다.
 *   (2) 룩업 테이블 우선  — 법령 표는 표 그대로 룩업으로 정의 (등차수열 산식 금지).
 *   (3) 산식 흐름 분리    — 본 모듈은 데이터·룩업 함수만, 13단계 산식은 tax_engine.
 *
 * 규약:
 *   - 모든 금액은 원 단위 정수.
 *   - 모든 비율은 [0, 1] 범위의 Number.
 *   - 연차 임계는 모두 정수 단위. 일자 단위 ±3일 비교는 tax_engine 책임.
 *   - ES6 module(import/export) 미사용. 비-모듈 <script src> 다중 로드.
 */
(function (global) {
  'use strict';

  // ==================================================================
  // 0. 메타데이터
  // ==================================================================

  /** 규칙 버전 식별자. taxResult.ruleVersion에 그대로 기록한다. */
  var RULE_VERSION = 'v0.2.0-post-20260510';

  /**
   * 본 규칙이 적용되는 양도일 하한 (포함, ISO date string).
   * 양도일이 이 날짜 이전이면 OUT_OF_V01_SCOPE_DATE issueFlag 발동(엔진 측에서).
   */
  var APPLICABLE_SALE_DATE_FROM = '2026-05-10';

  /** 적용 법령 라벨 (UI·로그용). v0.1 6키 + v0.2 신규 4키 = 10종. */
  var LAW_REFS = {
    incomeTaxAct:           '소득세법 [법률 제21065호, 2026-01-02 시행]',
    incomeTaxEnforcement:   '소득세법 시행령 [대통령령 제36129호, 2026-03-01 시행]',
    progressiveRate:        '소득세법 제55조 제1항',
    transferTaxRate:        '소득세법 제104조 제1항',
    basicDeduction:         '소득세법 제103조',
    localIncomeTax:         '지방세법 제103조의3',
    // v0.2 신규 (모듈 스펙 §3-6-2)
    nonTaxation1Se1House:   '소득세법 제89조 제1항 제3호, 시행령 제154조',
    highValueHouse:         '소득세법 제95조 제3항, 시행령 제160조 제1항',
    longTermDeductionTable1:'소득세법 제95조 제2항 표 1, 시행령 제159조의3',
    longTermDeductionTable2:'소득세법 제95조 제2항 표 2, 시행령 제159조의4'
  };

  // ==================================================================
  // 1. 양도소득 기본공제 (소득세법 제103조)
  // ==================================================================

  /** 거주자의 양도소득 기본공제액. 연 1회 한도. */
  var BASIC_DEDUCTION_AMOUNT = 2500000;

  // ==================================================================
  // 2. 지방소득세 (지방세법 제103조의3)
  //    산출세액의 10%, 원 미만 절사는 호출 측(tax_engine)에서 수행.
  // ==================================================================

  /** 지방소득세 세율: 산출세액의 10%. */
  var LOCAL_INCOME_TAX_RATE = 0.1;

  // ==================================================================
  // 3. 단기·미등기 세율 (소득세법 제104조 제1항)
  // ==================================================================

  /** 보유기간 1년 미만 단기세율 (주택). */
  var SHORT_TERM_RATE_UNDER_1Y = 0.7;

  /** 보유기간 1년 이상 2년 미만 단기세율 (주택). */
  var SHORT_TERM_RATE_UNDER_2Y = 0.6;

  /**
   * 미등기양도자산 세율 (소득세법 제104조 ① 제1호).
   * v0.2 본 코드에서는 항상 등기자산 가정이며 본 상수는 미사용.
   * 노출 멤버명은 v0.2 모듈 스펙 §11-5 결정에 따라 'UNREGISTERED_RATE' 채택.
   */
  var UNREGISTERED_RATE = 0.7;

  // ==================================================================
  // 4. 1세대1주택 비과세 임계 (소득세법 제89조 ① 제3호, 시행령 제154조 ①)
  // ==================================================================

  /**
   * 고가주택 임계: 1세대1주택 비과세 적용 시 양도가액이 본 임계 초과 → 안분 진입.
   * 안분 산식 (salePrice − HIGH_VALUE_HOUSE_THRESHOLD) / salePrice 는 tax_engine 책임.
   */
  var HIGH_VALUE_HOUSE_THRESHOLD = 1200000000;

  /** 1세대1주택 비과세 보유 최소 연수 (전국 공통). */
  var NON_TAXABLE_HOLDING_MIN_YEARS = 2;

  /** 1세대1주택 비과세 거주 최소 연수 (취득시 조정대상지역 한정). */
  var NON_TAXABLE_RESIDENCE_MIN_YEARS = 2;

  /**
   * 보유연수 정수 임계 — issueFlag 발동 임계로 사용.
   *   1: 단기세율 1년 분기
   *   2: 단기세율 2년 분기 + 비과세 보유·거주 임계
   *   3: 장특공 표 1·표 2 시작
   *  15: 장특공 표 1 상한 (15년 이상 30% 클램프)
   * 일자 단위 ±3일 비교는 tax_engine 책임 (§0-1 원칙 (3)).
   */
  var HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15];

  // ==================================================================
  // 5. 기본세율표 — 8단계 누진 (소득세법 제55조 제1항, 2026 시행)
  // ==================================================================

  /**
   * 누진세율표.
   *
   * 각 구간 brackets[i]에 대해:
   *   적용 조건: i === 0 이면 0 ≤ taxBase ≤ upperBound
   *               그 외 i 이면  prev.upperBound < taxBase ≤ upperBound
   *   산출세액:   baseTax + (taxBase − lowerBound) × marginalRate
   *
   * 누진 연속성:
   *   brackets[i].baseTax === brackets[i-1].baseTax
   *       + (brackets[i-1].upperBound − brackets[i-1].lowerBound) × brackets[i-1].marginalRate
   *
   * 명세서 §4-2, §4-3 참조.
   */
  var PROGRESSIVE_BRACKETS = [
    {
      idx: 1,
      lowerBound: 0,
      upperBound: 14000000,
      marginalRate: 0.06,
      baseTax: 0,
      label: '기본세율 1구간 (1,400만원 이하, 6%)'
    },
    {
      idx: 2,
      lowerBound: 14000000,
      upperBound: 50000000,
      marginalRate: 0.15,
      baseTax: 840000,
      label: '기본세율 2구간 (1,400만원 초과 5,000만원 이하, 15% 누진)'
    },
    {
      idx: 3,
      lowerBound: 50000000,
      upperBound: 88000000,
      marginalRate: 0.24,
      baseTax: 6240000,
      label: '기본세율 3구간 (5,000만원 초과 8,800만원 이하, 24% 누진)'
    },
    {
      idx: 4,
      lowerBound: 88000000,
      upperBound: 150000000,
      marginalRate: 0.35,
      baseTax: 15360000,
      label: '기본세율 4구간 (8,800만원 초과 1.5억 이하, 35% 누진)'
    },
    {
      idx: 5,
      lowerBound: 150000000,
      upperBound: 300000000,
      marginalRate: 0.38,
      baseTax: 37060000,
      label: '기본세율 5구간 (1.5억 초과 3억 이하, 38% 누진)'
    },
    {
      idx: 6,
      lowerBound: 300000000,
      upperBound: 500000000,
      marginalRate: 0.40,
      baseTax: 94060000,
      label: '기본세율 6구간 (3억 초과 5억 이하, 40% 누진)'
    },
    {
      idx: 7,
      lowerBound: 500000000,
      upperBound: 1000000000,
      marginalRate: 0.42,
      baseTax: 174060000,
      label: '기본세율 7구간 (5억 초과 10억 이하, 42% 누진)'
    },
    {
      idx: 8,
      lowerBound: 1000000000,
      upperBound: Infinity,
      marginalRate: 0.45,
      baseTax: 384060000,
      label: '기본세율 8구간 (10억 초과, 45% 누진)'
    }
  ];

  // ==================================================================
  // 6. 장기보유특별공제 표 1 — 일반 (v0.2 신규)
  //    근거: 소득세법 제95조 ② 표 1 (시행령 제159조의3 위임)
  //    13행, 보유연수 3~15년 (15년 이상 클램프)
  //    §0-1 원칙 (2) — 등차수열 산식 금지, 13행 수기 정의.
  // ==================================================================

  var LONG_TERM_DEDUCTION_TABLE_1 = [
    { idx: 1,  lowerBound: 3,  upperBound: 4,        rate: 0.06, label: '3년 이상 4년 미만' },
    { idx: 2,  lowerBound: 4,  upperBound: 5,        rate: 0.08, label: '4년 이상 5년 미만' },
    { idx: 3,  lowerBound: 5,  upperBound: 6,        rate: 0.10, label: '5년 이상 6년 미만' },
    { idx: 4,  lowerBound: 6,  upperBound: 7,        rate: 0.12, label: '6년 이상 7년 미만' },
    { idx: 5,  lowerBound: 7,  upperBound: 8,        rate: 0.14, label: '7년 이상 8년 미만' },
    { idx: 6,  lowerBound: 8,  upperBound: 9,        rate: 0.16, label: '8년 이상 9년 미만' },
    { idx: 7,  lowerBound: 9,  upperBound: 10,       rate: 0.18, label: '9년 이상 10년 미만' },
    { idx: 8,  lowerBound: 10, upperBound: 11,       rate: 0.20, label: '10년 이상 11년 미만' },
    { idx: 9,  lowerBound: 11, upperBound: 12,       rate: 0.22, label: '11년 이상 12년 미만' },
    { idx: 10, lowerBound: 12, upperBound: 13,       rate: 0.24, label: '12년 이상 13년 미만' },
    { idx: 11, lowerBound: 13, upperBound: 14,       rate: 0.26, label: '13년 이상 14년 미만' },
    { idx: 12, lowerBound: 14, upperBound: 15,       rate: 0.28, label: '14년 이상 15년 미만' },
    { idx: 13, lowerBound: 15, upperBound: Infinity, rate: 0.30, label: '15년 이상' }
  ];

  // ==================================================================
  // 7. 장기보유특별공제 표 2 좌측 — 보유공제율 (v0.2 신규)
  //    근거: 소득세법 제95조 ② 표 2 좌측 (시행령 제159조의4 위임)
  //    8행, 보유연수 3~10년 (10년 이상 클램프)
  // ==================================================================

  var LONG_TERM_DEDUCTION_TABLE_2_HOLDING = [
    { idx: 1, lowerBound: 3,  upperBound: 4,        rate: 0.12, label: '3년 이상 4년 미만' },
    { idx: 2, lowerBound: 4,  upperBound: 5,        rate: 0.16, label: '4년 이상 5년 미만' },
    { idx: 3, lowerBound: 5,  upperBound: 6,        rate: 0.20, label: '5년 이상 6년 미만' },
    { idx: 4, lowerBound: 6,  upperBound: 7,        rate: 0.24, label: '6년 이상 7년 미만' },
    { idx: 5, lowerBound: 7,  upperBound: 8,        rate: 0.28, label: '7년 이상 8년 미만' },
    { idx: 6, lowerBound: 8,  upperBound: 9,        rate: 0.32, label: '8년 이상 9년 미만' },
    { idx: 7, lowerBound: 9,  upperBound: 10,       rate: 0.36, label: '9년 이상 10년 미만' },
    { idx: 8, lowerBound: 10, upperBound: Infinity, rate: 0.40, label: '10년 이상' }
  ];

  // ==================================================================
  // 8. 장기보유특별공제 표 2 우측 — 거주공제율 (v0.2 신규)
  //    근거: 소득세법 제95조 ② 표 2 우측 (시행령 제159조의4 위임)
  //    9행, 거주연수 2~10년 (10년 이상 클램프)
  //    idx=1 단서 행: 거주 2~3년 미만 8% (보유 3년 이상 한정).
  //    9행 모두 requiresHoldingMin3y === true.
  // ==================================================================

  var LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE = [
    { idx: 1, lowerBound: 2,  upperBound: 3,        rate: 0.08, requiresHoldingMin3y: true, label: '2년 이상 3년 미만 (보유 3년 이상 한정)' },
    { idx: 2, lowerBound: 3,  upperBound: 4,        rate: 0.12, requiresHoldingMin3y: true, label: '3년 이상 4년 미만' },
    { idx: 3, lowerBound: 4,  upperBound: 5,        rate: 0.16, requiresHoldingMin3y: true, label: '4년 이상 5년 미만' },
    { idx: 4, lowerBound: 5,  upperBound: 6,        rate: 0.20, requiresHoldingMin3y: true, label: '5년 이상 6년 미만' },
    { idx: 5, lowerBound: 6,  upperBound: 7,        rate: 0.24, requiresHoldingMin3y: true, label: '6년 이상 7년 미만' },
    { idx: 6, lowerBound: 7,  upperBound: 8,        rate: 0.28, requiresHoldingMin3y: true, label: '7년 이상 8년 미만' },
    { idx: 7, lowerBound: 8,  upperBound: 9,        rate: 0.32, requiresHoldingMin3y: true, label: '8년 이상 9년 미만' },
    { idx: 8, lowerBound: 9,  upperBound: 10,       rate: 0.36, requiresHoldingMin3y: true, label: '9년 이상 10년 미만' },
    { idx: 9, lowerBound: 10, upperBound: Infinity, rate: 0.40, requiresHoldingMin3y: true, label: '10년 이상' }
  ];

  // ==================================================================
  // 9. 헬퍼: findBracket(taxBase) — v0.1 계승
  // ==================================================================

  /**
   * 주어진 과세표준이 속하는 누진세율 구간을 반환한다.
   *
   * 경계 처리:
   *   - 14,000,000 → 1구간 (상한 "이하")
   *   - 14,000,001 → 2구간
   *   - 0 → 1구간
   *
   * @param {number} taxBase 원 단위 정수, ≥ 0
   * @returns {object} PROGRESSIVE_BRACKETS의 한 원소 (참조 반환)
   * @throws {Error} taxBase가 음수, 비정수, 비유한, 비숫자인 경우
   */
  function findBracket(taxBase) {
    if (typeof taxBase !== 'number' ||
        !Number.isFinite(taxBase) ||
        !Number.isInteger(taxBase) ||
        taxBase < 0) {
      throw new Error('findBracket: taxBase must be a non-negative integer. got=' + taxBase);
    }
    for (var i = 0; i < PROGRESSIVE_BRACKETS.length; i++) {
      if (taxBase <= PROGRESSIVE_BRACKETS[i].upperBound) {
        return PROGRESSIVE_BRACKETS[i];
      }
    }
    // 8구간 upperBound가 Infinity이므로 도달 불가능.
    throw new Error('findBracket: unreachable. taxBase=' + taxBase);
  }

  // ==================================================================
  // 10. 헬퍼: findHoldingRate(holdingYears, table) — v0.2 신규
  //     장특공 표 1·표 2 좌측 공통 룩업.
  //     - 입력 검증: 비정수·NaN·Infinity·문자열·null·undefined·음수 → throw
  //     - 클램프: 표 시작 미만 → 0, 표 마지막 이상 → 표 최대 행 rate
  // ==================================================================

  function findHoldingRate(holdingYears, table) {
    if (typeof holdingYears !== 'number' ||
        !Number.isFinite(holdingYears) ||
        !Number.isInteger(holdingYears) ||
        holdingYears < 0) {
      throw new Error('findHoldingRate: holdingYears must be a non-negative integer. got=' + holdingYears);
    }
    if (!Array.isArray(table) || table.length === 0) {
      throw new Error('findHoldingRate: table must be a non-empty array');
    }
    if (holdingYears < table[0].lowerBound) {
      return 0;
    }
    var last = table[table.length - 1];
    if (holdingYears >= last.lowerBound) {
      return last.rate;
    }
    for (var i = 0; i < table.length; i++) {
      var row = table[i];
      if (holdingYears >= row.lowerBound && holdingYears < row.upperBound) {
        return row.rate;
      }
    }
    // 정상 입력에 대해 도달 불가 (행 사이 공백·중복 없음 — selfTest로 보장).
    throw new Error('findHoldingRate: unreachable. holdingYears=' + holdingYears);
  }

  // ==================================================================
  // 11. 헬퍼: findResidenceRate(residenceYears, holdingYears, table) — v0.2 신규
  //     장특공 표 2 우측 거주공제율 룩업. 단서(보유 3년 이상) 단속.
  //     - 입력 검증: residenceYears·holdingYears 모두 비정수/음수 → throw
  //     - holdingYears < 3 → 0 (전 행 단서 차단)
  //     - residenceYears < 2 → 0
  //     - 클램프: 거주 10년 이상 → 0.40
  // ==================================================================

  function findResidenceRate(residenceYears, holdingYears, table) {
    if (typeof residenceYears !== 'number' ||
        !Number.isFinite(residenceYears) ||
        !Number.isInteger(residenceYears) ||
        residenceYears < 0 ||
        typeof holdingYears !== 'number' ||
        !Number.isFinite(holdingYears) ||
        !Number.isInteger(holdingYears) ||
        holdingYears < 0) {
      throw new Error('findResidenceRate: residenceYears·holdingYears must be non-negative integers. got=' +
        residenceYears + ', ' + holdingYears);
    }
    if (!Array.isArray(table) || table.length === 0) {
      throw new Error('findResidenceRate: table must be a non-empty array');
    }
    // 단서 차단 — 평가 순서 중요: holdingYears 가드를 먼저 적용.
    if (holdingYears < 3) {
      return 0;
    }
    if (residenceYears < table[0].lowerBound) {
      return 0;
    }
    var last = table[table.length - 1];
    if (residenceYears >= last.lowerBound) {
      return last.rate;
    }
    for (var i = 0; i < table.length; i++) {
      var row = table[i];
      if (residenceYears >= row.lowerBound && residenceYears < row.upperBound) {
        return row.rate;
      }
    }
    throw new Error('findResidenceRate: unreachable. residenceYears=' + residenceYears);
  }

  // ==================================================================
  // 12. 자체검증 (명세서 §4-3 + 정수 보장 + 단조성 + v0.2 룩업 sanity)
  // ==================================================================

  /**
   * 누진 연속성 자체검증 (명세서 §4-3, 7개 경계).
   *
   * @returns {{ ok: boolean, checks: Array<{idx:number, upperBound:number, expected:number, actual:number, ok:boolean}> }}
   */
  function verifyProgressiveContinuity() {
    var checks = [];
    var ok = true;
    for (var i = 0; i < PROGRESSIVE_BRACKETS.length - 1; i++) {
      var cur  = PROGRESSIVE_BRACKETS[i];
      var next = PROGRESSIVE_BRACKETS[i + 1];
      var span = cur.upperBound - cur.lowerBound;
      var taxAtUpper = cur.baseTax + span * cur.marginalRate;
      var thisOk = (taxAtUpper === next.baseTax) && Number.isInteger(taxAtUpper);
      checks.push({
        idx: cur.idx,
        upperBound: cur.upperBound,
        expected: next.baseTax,
        actual: taxAtUpper,
        ok: thisOk
      });
      if (!thisOk) ok = false;
    }
    return { ok: ok, checks: checks };
  }

  /**
   * 모든 baseTax가 JS 정수인지 확인.
   * @returns {{ ok: boolean, fails: Array<{idx:number, value:number}> }}
   */
  function verifyBaseTaxAreIntegers() {
    var fails = [];
    for (var i = 0; i < PROGRESSIVE_BRACKETS.length; i++) {
      var b = PROGRESSIVE_BRACKETS[i];
      if (!Number.isInteger(b.baseTax)) {
        fails.push({ idx: b.idx, value: b.baseTax });
      }
    }
    return { ok: fails.length === 0, fails: fails };
  }

  /**
   * brackets의 단조성 자체검증.
   * @returns {{ ok: boolean, fails: Array<object> }}
   */
  function verifyMonotonic() {
    var fails = [];
    for (var i = 1; i < PROGRESSIVE_BRACKETS.length; i++) {
      var prev = PROGRESSIVE_BRACKETS[i - 1];
      var cur  = PROGRESSIVE_BRACKETS[i];
      if (cur.lowerBound !== prev.upperBound) {
        fails.push({
          at: cur.idx,
          kind: 'lowerBound !== prev.upperBound',
          prev: prev.upperBound,
          cur: cur.lowerBound
        });
      }
      if (cur.marginalRate <= prev.marginalRate) {
        fails.push({
          at: cur.idx,
          kind: 'marginalRate not strictly increasing',
          prev: prev.marginalRate,
          cur: cur.marginalRate
        });
      }
      if (cur.baseTax <= prev.baseTax) {
        fails.push({
          at: cur.idx,
          kind: 'baseTax not strictly increasing',
          prev: prev.baseTax,
          cur: cur.baseTax
        });
      }
    }
    return { ok: fails.length === 0, fails: fails };
  }

  /**
   * 장특공 표 1·표 2 좌측·표 2 우측 룩업 sanity 검증 (v0.2 신규).
   *
   * sanity 케이스 15건 (TC-006~010 회귀 보호 + 클램프·단서 케이스):
   *   - 표 1: 5건 (보유 2/3/5/12/20)
   *   - 표 2 좌측: 3건 (보유 8/10/50)
   *   - 표 2 우측: 7건 (거주 0·2·2·5·8·10·50)
   *
   * 모듈 스펙 §4-2-3 + §4-3-3 정본.
   *
   * @returns {{ ok: boolean, table1Fails: Array, table2HoldingFails: Array, table2ResidenceFails: Array }}
   */
  function verifyLongTermLookups() {
    var table1Cases = [
      { input: [2,  LONG_TERM_DEDUCTION_TABLE_1], expected: 0      },
      { input: [3,  LONG_TERM_DEDUCTION_TABLE_1], expected: 0.06   },
      { input: [5,  LONG_TERM_DEDUCTION_TABLE_1], expected: 0.10   },
      { input: [12, LONG_TERM_DEDUCTION_TABLE_1], expected: 0.24   },
      { input: [20, LONG_TERM_DEDUCTION_TABLE_1], expected: 0.30   }
    ];
    var table2HoldingCases = [
      { input: [8,  LONG_TERM_DEDUCTION_TABLE_2_HOLDING], expected: 0.32 },
      { input: [10, LONG_TERM_DEDUCTION_TABLE_2_HOLDING], expected: 0.40 },
      { input: [50, LONG_TERM_DEDUCTION_TABLE_2_HOLDING], expected: 0.40 }
    ];
    // findResidenceRate(residenceYears, holdingYears, table)
    var table2ResidenceCases = [
      { input: [0,  8,  LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0     },
      { input: [2,  2,  LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0     },
      { input: [2,  5,  LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0.08  },
      { input: [5,  5,  LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0.20  },
      { input: [8,  8,  LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0.32  },
      { input: [10, 10, LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0.40  },
      { input: [50, 50, LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE], expected: 0.40  }
    ];

    var table1Fails        = [];
    var table2HoldingFails = [];
    var table2ResidenceFails = [];

    table1Cases.forEach(function (c) {
      var actual = findHoldingRate(c.input[0], c.input[1]);
      if (actual !== c.expected) {
        table1Fails.push({ input: c.input, expected: c.expected, actual: actual });
      }
    });
    table2HoldingCases.forEach(function (c) {
      var actual = findHoldingRate(c.input[0], c.input[1]);
      if (actual !== c.expected) {
        table2HoldingFails.push({ input: c.input, expected: c.expected, actual: actual });
      }
    });
    table2ResidenceCases.forEach(function (c) {
      var actual = findResidenceRate(c.input[0], c.input[1], c.input[2]);
      if (actual !== c.expected) {
        table2ResidenceFails.push({ input: c.input, expected: c.expected, actual: actual });
      }
    });

    return {
      ok: table1Fails.length === 0 &&
          table2HoldingFails.length === 0 &&
          table2ResidenceFails.length === 0,
      table1Fails: table1Fails,
      table2HoldingFails: table2HoldingFails,
      table2ResidenceFails: table2ResidenceFails
    };
  }

  /**
   * 종합 자체검증.
   *
   * 페이지 로드 시 1회 호출 권장. ok === false이면 콘솔 경고 + 결과 화면 차단을
   * tax_engine 또는 부트스트랩 측에서 수행한다 (이 모듈은 throw하지 않음).
   *
   * v0.2 추가: longTermLookups 필드 (장특공 룩업 15건 sanity).
   *
   * @returns {{ ok: boolean, continuity: object, integers: object, monotonic: object, longTermLookups: object }}
   */
  function selfTest() {
    var cont = verifyProgressiveContinuity();
    var ints = verifyBaseTaxAreIntegers();
    var mono = verifyMonotonic();
    var lt   = verifyLongTermLookups();
    return {
      ok: cont.ok && ints.ok && mono.ok && lt.ok,
      continuity: cont,
      integers: ints,
      monotonic: mono,
      longTermLookups: lt
    };
  }

  // ==================================================================
  // 13. 노출 — window.TaxOpt.taxRules
  // ==================================================================

  global.TaxOpt = global.TaxOpt || {};
  global.TaxOpt.taxRules = {
    // 메타 (3종)
    RULE_VERSION: RULE_VERSION,
    APPLICABLE_SALE_DATE_FROM: APPLICABLE_SALE_DATE_FROM,
    LAW_REFS: LAW_REFS,
    // 금액·세율·임계 상수 (8종)
    BASIC_DEDUCTION_AMOUNT: BASIC_DEDUCTION_AMOUNT,
    LOCAL_INCOME_TAX_RATE: LOCAL_INCOME_TAX_RATE,
    SHORT_TERM_RATE_UNDER_1Y: SHORT_TERM_RATE_UNDER_1Y,
    SHORT_TERM_RATE_UNDER_2Y: SHORT_TERM_RATE_UNDER_2Y,
    UNREGISTERED_RATE: UNREGISTERED_RATE,
    HIGH_VALUE_HOUSE_THRESHOLD: HIGH_VALUE_HOUSE_THRESHOLD,
    NON_TAXABLE_HOLDING_MIN_YEARS: NON_TAXABLE_HOLDING_MIN_YEARS,
    NON_TAXABLE_RESIDENCE_MIN_YEARS: NON_TAXABLE_RESIDENCE_MIN_YEARS,
    // 임계 배열 (1종)
    HOLDING_PERIOD_BOUNDARY_YEARS: HOLDING_PERIOD_BOUNDARY_YEARS,
    // 룩업 테이블 (4종)
    PROGRESSIVE_BRACKETS: PROGRESSIVE_BRACKETS,
    LONG_TERM_DEDUCTION_TABLE_1: LONG_TERM_DEDUCTION_TABLE_1,
    LONG_TERM_DEDUCTION_TABLE_2_HOLDING: LONG_TERM_DEDUCTION_TABLE_2_HOLDING,
    LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE: LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE,
    // 헬퍼 (3종)
    findBracket: findBracket,
    findHoldingRate: findHoldingRate,
    findResidenceRate: findResidenceRate,
    // 자체검증 (5종)
    selfTest: selfTest,
    verifyProgressiveContinuity: verifyProgressiveContinuity,
    verifyBaseTaxAreIntegers: verifyBaseTaxAreIntegers,
    verifyMonotonic: verifyMonotonic,
    verifyLongTermLookups: verifyLongTermLookups
  };

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));
