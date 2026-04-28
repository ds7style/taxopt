/**
 * tax_rules.js
 *
 * TaxOpt 계산 엔진 v0.1.1 — 세법 규칙 데이터 모듈
 *
 * 책임:
 *   1) 양도소득세 계산에 필요한 "규칙 데이터(상수)"를 담는다.
 *   2) PROGRESSIVE_BRACKETS 데이터에 종속된 단일 책임 헬퍼(findBracket) 제공.
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
 * 적용 전제 (v0.1.1):
 *   - 양도일 ≥ 2026-05-10 (중과 유예 종료 후)
 *   - 비조정대상지역, 거주자, 단독명의, 매매취득, 등기자산
 *
 * 참조 문서:
 *   - 명세서:   docs/v0.1/01_calc_engine_spec.md
 *   - 골든셋:   docs/v0.1/06_test_cases.md
 *   - 의사결정: docs/99_decision_log.md (#5, #8)
 *
 * 규약:
 *   - 모든 금액은 원 단위 정수.
 *   - 모든 비율은 [0, 1] 범위의 Number.
 *   - ES6 module(import/export) 미사용. 비-모듈 <script src> 다중 로드.
 */
(function (global) {
  'use strict';

  // ==================================================================
  // 0. 메타데이터
  // ==================================================================

  /** 규칙 버전 식별자. taxResult.ruleVersion에 그대로 기록한다. */
  var RULE_VERSION = 'v0.1.1-post-20260510';

  /**
   * 본 규칙이 적용되는 양도일 하한 (포함, ISO date string).
   * 양도일이 이 날짜 이전이면 OUT_OF_V01_SCOPE_DATE issueFlag 발동(엔진 측에서).
   */
  var APPLICABLE_SALE_DATE_FROM = '2026-05-10';

  /** 적용 법령 라벨 (UI·로그용) */
  var LAW_REFS = {
    incomeTaxAct:         '소득세법 [법률 제21065호, 2026-01-02 시행]',
    incomeTaxEnforcement: '소득세법 시행령 [대통령령 제36129호, 2026-03-01 시행]',
    progressiveRate:      '소득세법 제55조 제1항',
    transferTaxRate:      '소득세법 제104조 제1항',
    basicDeduction:       '소득세법 제103조',
    localIncomeTax:       '지방세법 제103조의3'
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
  // 3. 단기세율 (소득세법 제104조 제1항 제2호·제3호)
  //    주택의 경우 1년 미만 70%, 1년 이상 2년 미만 60%
  // ==================================================================

  /** 보유기간 1년 미만 단기세율 (주택). */
  var SHORT_TERM_RATE_UNDER_1Y = 0.7;

  /** 보유기간 1년 이상 2년 미만 단기세율 (주택). */
  var SHORT_TERM_RATE_UNDER_2Y = 0.6;

  // ==================================================================
  // 4. 기본세율표 — 8단계 누진 (소득세법 제55조 제1항, 2026 시행)
  // ==================================================================

  /**
   * 누진세율표.
   *
   * 각 구간 brackets[i]에 대해:
   *   적용 조건: i === 0 이면 0 ≤ taxBase ≤ upperBound
   *               그 외 i 이면  prev.upperBound < taxBase ≤ upperBound
   *   산출세액:   baseTax + (taxBase − lowerBound) × marginalRate
   *
   * - lowerBound:    이 구간이 시작되는 과세표준 하한 (이전 구간의 upperBound와 동일).
   * - upperBound:    이 구간이 끝나는 과세표준 상한 (포함). 8구간은 Infinity.
   * - marginalRate:  이 구간의 한계세율.
   * - baseTax:       lowerBound 시점까지의 누적 산출세액 (정수, 명세서 §4-3 검증값).
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
  // 5. 헬퍼: findBracket(taxBase)
  // ==================================================================

  /**
   * 주어진 과세표준이 속하는 누진세율 구간을 반환한다.
   *
   * 경계 처리:
   *   - 14,000,000 → 1구간 (상한 "이하")
   *   - 14,000,001 → 2구간
   *   - 1,000,000,000 → 7구간
   *   - 1,000,000,001 → 8구간
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
  // 6. 자체검증 (명세서 §4-3 + 정수 보장 + 단조성)
  // ==================================================================

  /**
   * 누진 연속성 자체검증 (명세서 §4-3, 7개 경계).
   *
   * 각 구간 i에 대해:
   *   bracket[i].baseTax + (bracket[i].upperBound − bracket[i].lowerBound) × bracket[i].marginalRate
   *     === bracket[i+1].baseTax
   *
   * 8구간은 upperBound = Infinity이므로 검증 대상에서 제외 (i === 7 미포함).
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
   * (정수 산술 보장 — v0.1 검증 원칙 6번)
   *
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
   *   1) lowerBound[i] === upperBound[i-1] (구간 연결성)
   *   2) marginalRate 엄격 증가
   *   3) baseTax 엄격 증가
   *
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
   * 종합 자체검증.
   *
   * 페이지 로드 시 1회 호출 권장. ok === false이면 콘솔 경고 + 결과 화면 차단을
   * tax_engine 또는 부트스트랩 측에서 수행한다 (이 모듈은 throw하지 않음).
   *
   * @returns {{ ok: boolean, continuity: object, integers: object, monotonic: object }}
   */
  function selfTest() {
    var cont = verifyProgressiveContinuity();
    var ints = verifyBaseTaxAreIntegers();
    var mono = verifyMonotonic();
    return {
      ok: cont.ok && ints.ok && mono.ok,
      continuity: cont,
      integers: ints,
      monotonic: mono
    };
  }

  // ==================================================================
  // 7. 노출 — window.TaxOpt.taxRules
  // ==================================================================

  global.TaxOpt = global.TaxOpt || {};
  global.TaxOpt.taxRules = {
    // 메타
    RULE_VERSION: RULE_VERSION,
    APPLICABLE_SALE_DATE_FROM: APPLICABLE_SALE_DATE_FROM,
    LAW_REFS: LAW_REFS,
    // 상수
    BASIC_DEDUCTION_AMOUNT: BASIC_DEDUCTION_AMOUNT,
    LOCAL_INCOME_TAX_RATE: LOCAL_INCOME_TAX_RATE,
    SHORT_TERM_RATE_UNDER_1Y: SHORT_TERM_RATE_UNDER_1Y,
    SHORT_TERM_RATE_UNDER_2Y: SHORT_TERM_RATE_UNDER_2Y,
    PROGRESSIVE_BRACKETS: PROGRESSIVE_BRACKETS,
    // 헬퍼
    findBracket: findBracket,
    // 자체검증
    selfTest: selfTest,
    verifyProgressiveContinuity: verifyProgressiveContinuity,
    verifyBaseTaxAreIntegers: verifyBaseTaxAreIntegers,
    verifyMonotonic: verifyMonotonic
  };

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));