/**
 * tax-rules.js — TaxOpt 규칙 테이블 v0.1
 * ---------------------------------------------------------------
 * 목적
 *   양도소득세 계산에 필요한 규칙·세율·공제액·기준금액·시행일을
 *   정적 데이터로 보유한다. tax-engine.js / scenario-engine.js 등
 *   계산 모듈의 단일 진실 공급원(Single Source of Truth) 역할을 한다.
 *
 * 법령 근거
 *   - 소득세법 (시행 2026.1.2., 법률 제21065호)
 *     · 제55조 제1항: 종합소득과세표준에 적용되는 8단계 기본세율표
 *       (제104조에 따라 양도소득과세표준에도 동일하게 적용)
 *     · 제103조: 양도소득 기본공제 연 250만원
 *   - 소득세법 시행령 (시행 2026.3.1., 대통령령 제36129호)
 *   - 지방세법 (양도소득세 산출세액의 10% — 지방소득세)
 *
 * 버전
 *   ruleSetVersion: v0.1
 *   범위: 단일 주택 일반과세 계산을 지원하는 데 필요한 규칙만 포함.
 *   장특공 표 1·2, 1세대1주택 비과세 12억 기준, 다주택 중과 가산세율,
 *   단기보유 세율은 v0.2~v0.3에서 추가한다.
 *
 * 전제
 *   - 다주택 중과 유예가 종료된 상태(2026.5.10. 이후 양도)를 기본 전제로 한다.
 *     (의사결정 #1: 99_decision_log v2.md)
 *
 * 모듈 방식
 *   - ES6 module 문법(import/export) 사용하지 않음 (의사결정 #5)
 *   - 비-모듈 <script src="..."> 로드 환경에서 window.TAX_RULES로 접근
 *   - 외부 라이브러리 의존 없음 (순수 JavaScript)
 * ---------------------------------------------------------------
 */

(function () {
  'use strict';

  // ============================================================
  // 1. 메타데이터
  // ============================================================
  var meta = Object.freeze({
    ruleSetVersion: 'v0.1',
    effectiveDate: '2026-05-10', // 중과 유예 종료 다음날 (의사결정 #1)
    lawReferenceLaw: '소득세법 (시행 2026.1.2., 법률 제21065호)',
    lawReferenceDecree: '소득세법 시행령 (시행 2026.3.1., 대통령령 제36129호)',
    assumptions: Object.freeze({
      heavyTaxSuspensionEnded: true,
      suspensionEndDate: '2026-05-09',
      note: '본 규칙세트는 다주택 중과 유예가 종료된 상태(2026.5.10. 이후 양도)를 기본 전제로 한다.'
    }),
    lastUpdated: '2026-04-27',
    futureExtensionPlans: Object.freeze([
      'v0.2: 장기보유특별공제 표1·표2, 1세대1주택 비과세 12억원 기준 추가',
      'v0.3: 다주택 중과 가산세율(+20%p, +30%p), 단기보유 세율(40/50/60/70%) 추가'
    ])
  });

  // ============================================================
  // 2. 기본세율표 (소득세법 제55조 제1항, 제104조 적용)
  // ------------------------------------------------------------
  // 각 구간 객체 필드:
  //   - upTo:      구간 상한(원, 정수). 마지막 구간은 Infinity.
  //                "과세표준이 upTo 이하"이면 해당 구간 적용.
  //   - base:      구간 시작점까지의 누적 산출세액(원).
  //                법령 본문 표기: "84만원 + 1,400만원 초과액의 15%" 의 "84만원" 등.
  //                계산식: tax = base + (taxBase - prevUpTo) * rate
  //                (단, 첫 구간은 prevUpTo = 0, base = 0)
  //   - rate:      해당 구간의 한계세율(소수). 6% = 0.06.
  //   - deduction: 누진공제액(원). 단일식 표현용.
  //                계산식: tax = taxBase * rate - deduction
  //                (어느 쪽 표현이든 동일한 산출세액이 나오도록 사전 검증됨)
  //
  // tax-engine.js는 두 표현 중 어느 쪽이든 사용 가능.
  // ============================================================
  var basicTaxRateBrackets = Object.freeze([
    Object.freeze({
      upTo: 14000000,        // 1,400만원
      base: 0,
      rate: 0.06,
      deduction: 0
    }),
    Object.freeze({
      upTo: 50000000,        // 5,000만원
      base: 840000,          // 84만원
      rate: 0.15,
      deduction: 1260000     // 126만원
    }),
    Object.freeze({
      upTo: 88000000,        // 8,800만원
      base: 6240000,         // 624만원
      rate: 0.24,
      deduction: 5760000     // 576만원
    }),
    Object.freeze({
      upTo: 150000000,       // 1억5천만원
      base: 15360000,        // 1,536만원
      rate: 0.35,
      deduction: 15440000    // 1,544만원
    }),
    Object.freeze({
      upTo: 300000000,       // 3억원
      base: 37060000,        // 3,706만원
      rate: 0.38,
      deduction: 19940000    // 1,994만원
    }),
    Object.freeze({
      upTo: 500000000,       // 5억원
      base: 94060000,        // 9,406만원
      rate: 0.40,
      deduction: 25940000    // 2,594만원
    }),
    Object.freeze({
      upTo: 1000000000,      // 10억원
      base: 174060000,       // 1억7,406만원
      rate: 0.42,
      deduction: 35940000    // 3,594만원
    }),
    Object.freeze({
      upTo: Infinity,        // 10억원 초과
      base: 384060000,       // 3억8,406만원
      rate: 0.45,
      deduction: 65940000    // 6,594만원
    })
  ]);

  // ============================================================
  // 3. 양도소득 기본공제 (소득세법 제103조)
  // ------------------------------------------------------------
  // 거주자의 양도소득금액에서 연 250만원을 공제한다.
  // 동일 과세연도 내 여러 자산을 양도해도 250만원 한도. (소진 관리는 caseData.basicDeductionUsed)
  // ============================================================
  var basicDeductionAnnual = 2500000; // 250만원

  // ============================================================
  // 4. 지방소득세율 (지방세법)
  // ------------------------------------------------------------
  // 양도소득세 산출세액의 10%.
  // localIncomeTax = calculatedTax * localIncomeTaxRate
  // ============================================================
  var localIncomeTaxRate = 0.10;

  // ============================================================
  // 5. 다주택 중과 유예 종료일 (의사결정 #1)
  // ------------------------------------------------------------
  // - suspensionEndDate(2026-05-09)까지 양도하는 경우: 중과 유예 적용 가능 영역
  // - effectiveFromDate(2026-05-10) 이후 양도: 중과 적용 (v0.3에서 구현)
  // - v0.1은 일반과세만 다루므로 본 필드는 입력 검증 단계에서 경고용으로만 사용
  // ============================================================
  var heavyTaxSuspension = Object.freeze({
    suspensionEndDate: '2026-05-09',
    effectiveFromDate: '2026-05-10',
    note: '2026-05-10 이후 양도부터 다주택 중과 적용. v0.1은 일반과세만 지원하므로 중과세율은 v0.3에서 추가.'
  });

  // ============================================================
  // 6. 통합 규칙 객체 (단일 진실 공급원)
  // ============================================================
  var RULES_V0_1 = Object.freeze({
    meta: meta,
    basicTaxRateBrackets: basicTaxRateBrackets,
    basicDeductionAnnual: basicDeductionAnnual,
    localIncomeTaxRate: localIncomeTaxRate,
    heavyTaxSuspension: heavyTaxSuspension
  });

  // ============================================================
  // 7. 헬퍼 함수: 적용 구간 조회
  // ------------------------------------------------------------
  // 입력 과세표준에 적용되는 세율 구간 객체를 반환.
  // 산출세액 계산 자체는 tax-engine.js의 책임이며, 본 함수는
  // 어느 구간이 적용되는지만 반환한다.
  //
  // 입력
  //   taxBase: 과세표준 (원, 0 이상의 정수 권장)
  //
  // 출력
  //   적용 구간 객체 (frozen). 입력이 유효하지 않으면 null.
  //
  // 예외처리
  //   - null / undefined / 비-number / NaN → null 반환
  //   - 음수 → null 반환 (음수 과세표준은 정의되지 않음)
  //   - 0 → 첫 구간(rate 0.06) 반환
  // ============================================================
  function getApplicableBracket(taxBase) {
    if (taxBase === null || taxBase === undefined) {
      return null;
    }
    if (typeof taxBase !== 'number' || Number.isNaN(taxBase)) {
      return null;
    }
    if (taxBase < 0) {
      return null;
    }
    for (var i = 0; i < basicTaxRateBrackets.length; i++) {
      if (taxBase <= basicTaxRateBrackets[i].upTo) {
        return basicTaxRateBrackets[i];
      }
    }
    // 이론상 마지막 구간이 Infinity이므로 도달하지 않음 (방어적 반환)
    return null;
  }

  // ============================================================
  // 8. 전역 노출 (비-모듈 <script> 로드 환경용)
  // ============================================================
  if (typeof window !== 'undefined') {
    window.TAX_RULES = RULES_V0_1;
    window.getApplicableBracket = getApplicableBracket;
  }

  // ============================================================
  // 9. 자체 검증 (로드 시 콘솔 출력)
  //    이상 시 경고 로그를 남기되 throw하지 않음.
  // ============================================================
  (function selfCheck() {
    var checks = [
      {
        name: 'basicTaxRateBrackets has 8 entries',
        ok: basicTaxRateBrackets.length === 8
      },
      {
        name: 'last bracket upTo is Infinity',
        ok: basicTaxRateBrackets[basicTaxRateBrackets.length - 1].upTo === Infinity
      },
      {
        name: 'basicDeductionAnnual === 2,500,000',
        ok: basicDeductionAnnual === 2500000
      },
      {
        name: 'localIncomeTaxRate === 0.10',
        ok: localIncomeTaxRate === 0.10
      },
      {
        name: 'RULES_V0_1 is frozen',
        ok: Object.isFrozen(RULES_V0_1)
      }
    ];
    var failed = checks.filter(function (c) { return !c.ok; });
    if (failed.length === 0) {
      if (typeof console !== 'undefined') {
        console.log('[tax-rules.js] v0.1 loaded. Self-check passed (' + checks.length + '/' + checks.length + ').');
      }
    } else {
      if (typeof console !== 'undefined') {
        console.warn('[tax-rules.js] Self-check FAILED:', failed.map(function (c) { return c.name; }));
      }
    }
  })();

})();