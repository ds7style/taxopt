/**
 * tax_engine.js
 *
 * TaxOpt 계산 엔진 v0.2.0 — 13단계 양도소득세 계산 파이프라인
 *
 * 책임:
 *   1) caseData 입력을 받아 0~13단계 + B-008 보강 + issueFlag 수집을 수행한다.
 *   2) 모듈 스펙 §4의 taxResult 객체를 반환한다.
 *   3) selfTest()로 부트스트랩 시점 자체검증(룰 무결성 + sanity) 수행.
 *
 * 비책임:
 *   - 세법 규칙 데이터 (→ tax_rules.js)
 *   - 화면 DOM 접근 (→ index.html / result_renderer.js)
 *   - caseData 입력 수집·정규화 (→ input_collector.js)
 *   - 시나리오 조합·정렬 (→ scenario_engine.js, v0.3)
 *
 * 노출:
 *   window.TaxOpt.taxEngine
 *
 * 의존:
 *   window.TaxOpt.taxRules (tax_rules.js v0.2.0, 선행 로드 필수)
 *
 * 참조 문서:
 *   - 모듈 스펙:    docs/v0.2/modules/tax_engine.md v0.2.1 (단일 진본)
 *   - 명세서:       docs/v0.2/01_calc_engine_spec.md v0.2.1 (산식 정본)
 *   - 작업지시서:   docs/05_code_work_orders/04_tax_engine_v0_2.md v0.2.0
 *   - 골든셋:       docs/v0.2/06_test_cases.md v0.2.1 (TC-006~010, KPI 100%)
 *   - 의사결정:     docs/99_decision_log.md (#5 강화, #9 v9, #11)
 *
 * v0.1.1 → v0.2.0 변경 요약:
 *   - 단계 0 (validateCaseData): v0.2 신규 검증 5종 + 자동 보정 7종 (B-019)
 *   - 단계 2 (1세대1주택 비과세): check1Se1HouseExemption 결정 트리 활성
 *   - 단계 3 (고가주택 안분): calculateHighValuePortion 안분 활성
 *   - 단계 4 (장특공): calculateLongTermDeduction 표 1·표 2 룩업 호출
 *   - 단계 1·5~13: v0.1.1 그대로
 *   - result.steps: v0.2 신규 10종 필드
 *   - issueFlag 카탈로그: 10종 → 18종 (유지 5 + 변경 5 + 신규 5 + 보조 3)
 *   - ENGINE_VERSION: "v0.1.1-post-20260510" → "v0.2.0-post-20260510"
 *   - v0.1 노출 17종 시그니처·반환 형식 그대로 보존 + v0.2 신규 3종 노출
 *
 * 규약:
 *   - 모든 금액은 원 단위 정수.
 *   - 절사 위치 (v0.2): 단계 3 안분 후 + 단계 4 장특공 후 + 단계 10 산출세액 + 단계 11 지방소득세 (총 4회)
 *   - effectiveTaxRate는 비율이므로 절사하지 않는다.
 *   - caseData 입력 객체를 변경하지 않는다 (순수 함수, deep clone 후 보정).
 *   - DOM 접근 없음. 외부 라이브러리 의존 없음. ES6 module 미사용.
 *   - 법령 숫자 직접 보유 금지 (의사결정 #5 강화 §0-1 원칙 (3)). 모든 공제율은 tax_rules 룩업 호출.
 */
(function (global) {
  'use strict';

  // ==================================================================
  // 0. 메타데이터
  // ==================================================================

  var ENGINE_VERSION = 'v0.2.0-post-20260510';

  // tax_rules 의존을 호출 시점에 해소하기 위한 헬퍼 (모듈 스펙 §8-2 부트스트랩 가드)
  function getRules() {
    if (!global.TaxOpt || !global.TaxOpt.taxRules) {
      throw new Error('tax_engine: tax_rules.js가 먼저 로드되어야 합니다.');
    }
    return global.TaxOpt.taxRules;
  }

  // v0.2 부트스트랩 가드 — 단계 2·3·4 본문 활성에 필요한 규칙 데이터 노출 확인 (모듈 스펙 §8-2-1)
  function ensureV02Rules(rs) {
    if (typeof rs.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') {
      throw new Error('tax_engine v0.2: tax_rules v0.2 (HIGH_VALUE_HOUSE_THRESHOLD 등) 미로드.');
    }
    if (typeof rs.NON_TAXABLE_HOLDING_MIN_YEARS === 'undefined' ||
        typeof rs.NON_TAXABLE_RESIDENCE_MIN_YEARS === 'undefined') {
      throw new Error('tax_engine v0.2: tax_rules v0.2 비과세 임계 미로드.');
    }
    if (typeof rs.findHoldingRate !== 'function' ||
        typeof rs.findResidenceRate !== 'function') {
      throw new Error('tax_engine v0.2: tax_rules v0.2 룩업 함수 미로드.');
    }
    if (!Array.isArray(rs.LONG_TERM_DEDUCTION_TABLE_1) ||
        !Array.isArray(rs.LONG_TERM_DEDUCTION_TABLE_2_HOLDING) ||
        !Array.isArray(rs.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE)) {
      throw new Error('tax_engine v0.2: tax_rules v0.2 장특공 테이블 미로드.');
    }
  }

  // ==================================================================
  // 1. 날짜 헬퍼 (JS Date 산술 회피)
  // ==================================================================

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // "YYYY-MM-DD" → { y, mo, d } (parseInt 기반). 패턴 불일치 시 null.
  function parseISODate(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var y  = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d  = parseInt(m[3], 10);
    if (mo < 1 || mo > 12) return null;
    if (d  < 1 || d  > 31) return null;
    return { y: y, mo: mo, d: d };
  }

  function isValidISODate(s) {
    return parseISODate(s) !== null;
  }

  function addYearsMark(parts, plus) {
    return (parts.y + plus) + '-' + pad2(parts.mo) + '-' + pad2(parts.d);
  }

  // 보유기간 경계 ±3일 판정에서만 Date 사용 (모듈 스펙 §5-8).
  function diffDaysAbs(isoA, isoB) {
    var a = Date.parse(isoA + 'T00:00:00Z');
    var b = Date.parse(isoB + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.abs((a - b) / 86400000);
  }

  // 보유 정수 연차 산정 — 동월동일 비교 알고리즘 (작업지시서 §4-2-2, v0.1.1 §3 그대로).
  // saleDate >= addYearsMark(acquisitionDate, n)을 만족하는 가장 큰 n을 holdingYears로 한다.
  // 윤년 2/29는 v0.1.1과 동일하게 문자열 비교로 처리 (TC-001~010에 해당 케이스 없음).
  function computeHoldingYears(acquisitionDate, saleDate) {
    var ap = parseISODate(acquisitionDate);
    if (!ap) {
      throw new Error('computeHoldingYears: acquisitionDate 파싱 실패. got=' + acquisitionDate);
    }
    if (!isValidISODate(saleDate)) {
      throw new Error('computeHoldingYears: saleDate 파싱 실패. got=' + saleDate);
    }
    if (saleDate < addYearsMark(ap, 1)) return 0;
    // saleDate가 acquisitionDate보다 이전이면 0 (호출 측에서 validateCaseData가 차단하지만 방어).
    var n = 0;
    while (saleDate >= addYearsMark(ap, n + 1)) {
      n++;
      if (n > 100) break; // 무한 루프 방어 (사실상 도달 불가)
    }
    return n;
  }

  // ==================================================================
  // 2. House 선택 + 단축형 input 매핑
  // ==================================================================

  function pickHouse(caseData, houseId) {
    if (!caseData || typeof caseData !== 'object') {
      throw new Error('tax_engine: caseData가 객체가 아닙니다.');
    }
    if (!Array.isArray(caseData.houses) || caseData.houses.length === 0) {
      throw new Error('tax_engine: caseData.houses가 비어 있습니다.');
    }
    var id = houseId;
    if (id === undefined || id === null) {
      var sp = caseData.salePlan;
      if (sp && Array.isArray(sp.candidateHouseIds) && sp.candidateHouseIds.length > 0) {
        id = sp.candidateHouseIds[0];
      } else {
        id = caseData.houses[0].id;
      }
    }
    for (var i = 0; i < caseData.houses.length; i++) {
      if (caseData.houses[i].id === id) return caseData.houses[i];
    }
    throw new Error('tax_engine: houseId="' + id + '"에 해당하는 House가 없습니다.');
  }

  function normalizeInput(caseData, house) {
    var sp = caseData.salePlan;
    var candidateCount =
      (sp && Array.isArray(sp.candidateHouseIds)) ? sp.candidateHouseIds.length : 1;
    return {
      // 계산용 단축형
      salePrice:           house.expectedSalePrice,
      acquisitionPrice:    house.acquisitionPrice,
      necessaryExpense:    house.necessaryExpense,
      acquisitionDate:     house.acquisitionDate,
      saleDate:            house.expectedSaleDate,
      basicDeductionUsed:  caseData.basicDeductionUsed === true,
      // issueFlag·v0.2 비과세 판정용 보존
      acquisitionRegulated: house.acquisitionRegulated === true,
      saleRegulated:        house.saleRegulated === true,
      residenceMonths:      house.residenceMonths,
      livingNow:            house.livingNow === true,
      candidateHouseCount:  candidateCount,
      houseId:              house.id
    };
  }

  // 깊은 복사 (caseData 입력 변경 금지 원칙).
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ==================================================================
  // 3. 0단계 — validateCaseData (v0.2 보강)
  //    - v0.1 검증 8종 그대로
  //    - v0.2 신규 검증 5종 + 자동 보정 7종 (B-019, 명세서 §7-2·§7-3)
  //    - 입력 변경 금지: deep clone 후 보정.
  // ==================================================================

  function validateCaseData(caseData) {
    var errors = [];
    var warnings = [];
    var autoCorrections = [];

    if (!caseData || typeof caseData !== 'object') {
      errors.push('caseData가 객체가 아닙니다.');
      return {
        ok: false, errors: errors, warnings: warnings,
        correctedCaseData: null, autoCorrections: autoCorrections
      };
    }
    if (!Array.isArray(caseData.houses) || caseData.houses.length === 0) {
      errors.push('houses 배열이 비어 있습니다.');
      return {
        ok: false, errors: errors, warnings: warnings,
        correctedCaseData: null, autoCorrections: autoCorrections
      };
    }

    var corrected = deepClone(caseData);
    var house;
    try {
      house = pickHouse(corrected, undefined);
    } catch (e) {
      errors.push(e.message);
      return {
        ok: false, errors: errors, warnings: warnings,
        correctedCaseData: null, autoCorrections: autoCorrections
      };
    }

    // ─── v0.1 검증 8종 (그대로) ─────────────────────────────────
    // 1. salePrice
    if (!Number.isInteger(house.expectedSalePrice) || house.expectedSalePrice < 1) {
      errors.push('salePrice는 1 이상의 정수여야 합니다. (받은 값: ' + house.expectedSalePrice + ')');
    }
    // 2. acquisitionPrice
    if (!Number.isInteger(house.acquisitionPrice) || house.acquisitionPrice < 1) {
      errors.push('acquisitionPrice는 1 이상의 정수여야 합니다. (받은 값: ' + house.acquisitionPrice + ')');
    }
    // 3. necessaryExpense
    if (!Number.isInteger(house.necessaryExpense) || house.necessaryExpense < 0) {
      errors.push('necessaryExpense는 0 이상의 정수여야 합니다. (받은 값: ' + house.necessaryExpense + ')');
    }
    // 4. acquisitionDate
    if (!isValidISODate(house.acquisitionDate)) {
      errors.push('acquisitionDate가 "YYYY-MM-DD" 형식이 아닙니다. (받은 값: ' + house.acquisitionDate + ')');
    }
    // 5. saleDate
    if (!isValidISODate(house.expectedSaleDate)) {
      errors.push('expectedSaleDate가 "YYYY-MM-DD" 형식이 아닙니다. (받은 값: ' + house.expectedSaleDate + ')');
    }
    // 6. acquisitionDate < saleDate
    if (isValidISODate(house.acquisitionDate) && isValidISODate(house.expectedSaleDate)) {
      if (!(house.acquisitionDate < house.expectedSaleDate)) {
        errors.push('acquisitionDate(' + house.acquisitionDate + ')는 expectedSaleDate(' +
                    house.expectedSaleDate + ')보다 빠른 날짜여야 합니다.');
      }
    }

    // ─── v0.2 신규 검증 + 자동 보정 (명세서 §7-2·§7-3) ─────────
    // (9) householdHouseCount: 누락→자동 보정, 음수·0→에러
    if (typeof corrected.householdHouseCount === 'undefined' || corrected.householdHouseCount === null) {
      var sp = corrected.salePlan;
      var inferred = (sp && Array.isArray(sp.candidateHouseIds))
                      ? sp.candidateHouseIds.length : 1;
      corrected.householdHouseCount = inferred;
      autoCorrections.push('HOUSEHOLD_COUNT_INFERRED');
    } else if (!Number.isInteger(corrected.householdHouseCount) || corrected.householdHouseCount < 1) {
      errors.push('householdHouseCount는 1 이상의 정수여야 합니다. (받은 값: ' + corrected.householdHouseCount + ')');
    }

    // (10) residenceMonths: 누락→0 보정, 음수→에러
    if (typeof house.residenceMonths === 'undefined' || house.residenceMonths === null) {
      house.residenceMonths = 0;
      autoCorrections.push('RESIDENCE_MONTHS_DEFAULTED_ZERO');
    } else if (!Number.isInteger(house.residenceMonths) || house.residenceMonths < 0) {
      errors.push('residenceMonths는 0 이상의 정수여야 합니다. (받은 값: ' + house.residenceMonths + ')');
    }

    // (11) livingNow: 누락→false 보정
    if (typeof house.livingNow === 'undefined' || house.livingNow === null) {
      house.livingNow = false;
    }
    // (12) isOneTimeTwoHouses: 누락→false 보정
    if (typeof corrected.isOneTimeTwoHouses === 'undefined' || corrected.isOneTimeTwoHouses === null) {
      corrected.isOneTimeTwoHouses = false;
    }
    // (13) acquisitionRegulated: 누락→false 보정 (v0.1 호환)
    if (typeof house.acquisitionRegulated === 'undefined' || house.acquisitionRegulated === null) {
      house.acquisitionRegulated = false;
    }

    // 사전 자동 보정 (v0.1.2) — issueFlag 미발동
    if (typeof corrected.specialTaxFlags === 'undefined' || corrected.specialTaxFlags === null) {
      corrected.specialTaxFlags = {
        isFarmHouse: false,
        isHometownHouse: false,
        isPopulationDeclineAreaHouse: false,
        isLongTermRental: false
      };
    }
    if (typeof corrected.specialTaxRequirementsMet === 'undefined' ||
        corrected.specialTaxRequirementsMet === null) {
      corrected.specialTaxRequirementsMet = [];
    }

    // 에러가 없는 경우에만 경고 항목을 평가
    if (errors.length === 0) {
      // 7. saleDate.year === baseYear (권고)
      var saleYear = parseInt(house.expectedSaleDate.substring(0, 4), 10);
      if (Number.isInteger(corrected.baseYear) && saleYear !== corrected.baseYear) {
        warnings.push('expectedSaleDate.year(' + saleYear +
                      ')와 baseYear(' + corrected.baseYear + ')가 다릅니다.');
      }
      // 8. saleDate ≥ APPLICABLE_SALE_DATE_FROM
      var floorDate = '2026-05-10';
      try { floorDate = getRules().APPLICABLE_SALE_DATE_FROM; } catch (e) { /* 부트스트랩 단계에서는 fallback */ }
      if (house.expectedSaleDate < floorDate) {
        warnings.push('expectedSaleDate(' + house.expectedSaleDate +
                      ')가 적용 하한(' + floorDate + ') 이전입니다.');
      }
      // 9. v0.2 발동조건 축소 — saleRegulated만 (v0.1 → v0.2: acquisitionRegulated는 거주요건 정상 활용)
      if (house.saleRegulated === true) {
        warnings.push('양도 시점에 조정대상지역이 포함되어 있습니다 (v0.2 일반과세로 계산, v0.3 중과 예정).');
      }
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      correctedCaseData: errors.length === 0 ? corrected : null,
      autoCorrections: autoCorrections
    };
  }

  // ==================================================================
  // 4. 13단계 파이프라인 함수 (v0.1 시그니처 그대로 + 단계 2·3·4 본문 활성)
  //    단계 2·3·4의 시그니처는 v0.1과 동일하게 유지하되,
  //    실제 v0.2 분기는 calculateSingleTransfer가 보조 함수
  //    (check1Se1HouseExemption / calculateHighValuePortion / calculateLongTermDeduction)를
  //    직접 호출하는 방식으로 처리한다.
  //    이 패턴은 v0.1 회귀 (예: applyNonTaxation(290000000, {}) === 290000000) 보존을 위해 채택.
  // ==================================================================

  // 1단계: 양도차익
  function computeTransferGain(input) {
    return input.salePrice - input.acquisitionPrice - input.necessaryExpense;
  }

  // 2단계: 비과세 — v0.2 활성. caseData가 충분하면 결정 트리 호출 결과 반영.
  // v0.1 호환: caseData 부족 시 passthrough (transferGain 그대로).
  function applyNonTaxation(transferGain, caseData) {
    if (!caseData || !Array.isArray(caseData.houses) || caseData.houses.length === 0) {
      return transferGain;
    }
    if (typeof caseData.householdHouseCount === 'undefined') {
      return transferGain;
    }
    try {
      var house = pickHouse(caseData);
      var input = normalizeInput(caseData, house);
      var rs = getRules();
      if (typeof rs.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') return transferGain;
      var ex = check1Se1HouseExemption({
        householdHouseCount:  caseData.householdHouseCount,
        acquisitionDate:      input.acquisitionDate,
        saleDate:             input.saleDate,
        acquisitionRegulated: input.acquisitionRegulated,
        residenceMonths:      input.residenceMonths,
        salePrice:            input.salePrice
      });
      if (ex.terminateAt2) return 0;
      return transferGain;
    } catch (e) {
      return transferGain;
    }
  }

  // 3단계: 고가주택 안분 — v0.2 활성. caseData가 충분하면 안분 적용.
  // v0.1 호환: caseData 부족 시 passthrough.
  function applyHighValueAllocation(taxableGain, caseData) {
    if (!caseData || !Array.isArray(caseData.houses) || caseData.houses.length === 0) {
      return taxableGain;
    }
    if (typeof caseData.householdHouseCount === 'undefined') {
      return taxableGain;
    }
    try {
      var house = pickHouse(caseData);
      var input = normalizeInput(caseData, house);
      var rs = getRules();
      if (typeof rs.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') return taxableGain;
      var ex = check1Se1HouseExemption({
        householdHouseCount:  caseData.householdHouseCount,
        acquisitionDate:      input.acquisitionDate,
        saleDate:             input.saleDate,
        acquisitionRegulated: input.acquisitionRegulated,
        residenceMonths:      input.residenceMonths,
        salePrice:            input.salePrice
      });
      if (!ex.is1Se1House || !ex.isHighValueHouse) return taxableGain;
      var portion = calculateHighValuePortion({
        transferGain: taxableGain,
        salePrice:    input.salePrice
      });
      return portion.taxableGain;
    } catch (e) {
      return taxableGain;
    }
  }

  // 4단계: 장기보유특별공제 — v0.1 회귀를 위한 stub 유지.
  // calculateSingleTransfer는 calculateLongTermDeduction을 직접 호출하여 정확한 값 사용.
  // 직접 호출(예: 회귀 테스트 단위)이라 caseData가 빈 객체일 때 v0.1 호환을 위해 0 반환.
  function computeLongTermDeduction(_taxableGain, _caseData) {
    return 0;
  }

  // 5단계: 양도소득금액
  function computeCapitalGainIncome(taxableGain, longTermDeduction) {
    return taxableGain - longTermDeduction;
  }

  // 6단계: 기본공제
  function computeBasicDeduction(basicDeductionUsed) {
    return basicDeductionUsed ? 0 : getRules().BASIC_DEDUCTION_AMOUNT;
  }

  // 7단계: 과세표준 (양도차손 시 자동 0)
  function computeTaxBase(capitalGainIncome, basicDeduction) {
    return Math.max(0, capitalGainIncome - basicDeduction);
  }

  // 8단계: 보유기간 분기 (동월동일 문자열 비교)
  function determineHoldingPeriodBranch(acquisitionDate, saleDate) {
    var ap = parseISODate(acquisitionDate);
    if (!ap) {
      throw new Error('determineHoldingPeriodBranch: acquisitionDate 파싱 실패. got=' + acquisitionDate);
    }
    if (!isValidISODate(saleDate)) {
      throw new Error('determineHoldingPeriodBranch: saleDate 파싱 실패. got=' + saleDate);
    }
    var oneYearMark = addYearsMark(ap, 1);
    var twoYearMark = addYearsMark(ap, 2);
    if (saleDate <  oneYearMark) return 'under1y';
    if (saleDate <  twoYearMark) return 'under2y';
    return 'over2y';
  }

  // 9단계: 적용 세율 결정
  function determineAppliedRate(branch, taxBase) {
    var rs = getRules();
    if (branch === 'under1y') {
      return {
        type: 'short70',
        bracket: null,
        label: '단기세율 70% (1년 미만 보유)',
        marginalRate: rs.SHORT_TERM_RATE_UNDER_1Y,
        baseTax: 0,
        lowerBound: 0
      };
    }
    if (branch === 'under2y') {
      return {
        type: 'short60',
        bracket: null,
        label: '단기세율 60% (1~2년 보유)',
        marginalRate: rs.SHORT_TERM_RATE_UNDER_2Y,
        baseTax: 0,
        lowerBound: 0
      };
    }
    if (branch === 'over2y') {
      var b = rs.findBracket(taxBase);
      return {
        type: 'basic',
        bracket: b.idx,
        label: b.label,
        marginalRate: b.marginalRate,
        baseTax: b.baseTax,
        lowerBound: b.lowerBound
      };
    }
    throw new Error('determineAppliedRate: invalid branch="' + branch + '"');
  }

  // 10단계: 산출세액 (Math.floor 절사)
  function computeCalculatedTax(taxBase, appliedRate) {
    if (appliedRate.type === 'short70' || appliedRate.type === 'short60') {
      return Math.floor(taxBase * appliedRate.marginalRate);
    }
    return Math.floor(
      appliedRate.baseTax + (taxBase - appliedRate.lowerBound) * appliedRate.marginalRate
    );
  }

  // 11단계: 지방소득세 (Math.floor 절사)
  function computeLocalIncomeTax(calculatedTax) {
    return Math.floor(calculatedTax * getRules().LOCAL_INCOME_TAX_RATE);
  }

  // 12단계: 총 납부세액
  function computeTotalTax(calculatedTax, localIncomeTax) {
    return calculatedTax + localIncomeTax;
  }

  // 13단계: 세후 매각금액
  function computeNetAfterTaxSaleAmount(salePrice, totalTax) {
    return salePrice - totalTax;
  }

  // 보강 (B-008): 실효세율
  function computeEffectiveTaxRate(totalTax, salePrice) {
    return salePrice === 0 ? null : totalTax / salePrice;
  }

  // ==================================================================
  // 5. v0.2 신규 보조 함수 (모듈 스펙 §5-1-1·§5-2-1·§5-3-1)
  // ==================================================================

  // 5-1. 1세대1주택 비과세 결정 트리 (명세서 §3-1)
  // 입력:  { householdHouseCount, acquisitionDate, saleDate, acquisitionRegulated, residenceMonths, salePrice }
  // 출력:  { is1Se1House, isHighValueHouse, terminateAt2, holdingYears, residenceYears, reason }
  function check1Se1HouseExemption(input) {
    var rs = getRules();
    var holdMin = rs.NON_TAXABLE_HOLDING_MIN_YEARS;        // 정본 명칭 (인계 1)
    var residenceMinMonths = rs.NON_TAXABLE_RESIDENCE_MIN_YEARS * 12;
    var highValueThreshold = rs.HIGH_VALUE_HOUSE_THRESHOLD;

    var holdingYears = computeHoldingYears(input.acquisitionDate, input.saleDate);
    var residenceYears = Math.floor((input.residenceMonths || 0) / 12);

    // (a) 다주택 차단
    if (input.householdHouseCount !== 1) {
      return {
        is1Se1House: false,
        isHighValueHouse: false,
        terminateAt2: false,
        holdingYears: holdingYears,
        residenceYears: residenceYears,
        reason: 'MULTI_HOUSE'
      };
    }

    // (b) 보유 임계 (전국 공통, 정수 연차 비교)
    if (holdingYears < holdMin) {
      return {
        is1Se1House: false,
        isHighValueHouse: false,
        terminateAt2: false,
        holdingYears: holdingYears,
        residenceYears: residenceYears,
        reason: 'HOLDING_LT_2Y'
      };
    }

    // (c) 거주요건 — acquisitionRegulated 시에만 적용 (단위 변환은 호출 측, 작업지시서 §6-2)
    if (input.acquisitionRegulated === true) {
      if (!Number.isInteger(input.residenceMonths) || input.residenceMonths < residenceMinMonths) {
        return {
          is1Se1House: false,
          isHighValueHouse: false,
          terminateAt2: false,
          holdingYears: holdingYears,
          residenceYears: residenceYears,
          reason: 'RESIDENCE_LT_24M_REGULATED'
        };
      }
    }

    // (e)·(f) is1Se1House 확정 → 12억 비교
    if (input.salePrice <= highValueThreshold) {
      return {
        is1Se1House: true,
        isHighValueHouse: false,
        terminateAt2: true,
        holdingYears: holdingYears,
        residenceYears: residenceYears,
        reason: 'EXEMPT_UNDER_12B'
      };
    }
    return {
      is1Se1House: true,
      isHighValueHouse: true,
      terminateAt2: false,
      holdingYears: holdingYears,
      residenceYears: residenceYears,
      reason: 'HIGH_VALUE_ALLOCATION'
    };
  }

  // 5-2. 고가주택 12억 초과 안분 (명세서 §4-3, 시행령 제160조 ①)
  // 입력:  { transferGain, salePrice }
  // 출력:  { taxableGain, allocationRatio }
  function calculateHighValuePortion(input) {
    var rs = getRules();
    var threshold = rs.HIGH_VALUE_HOUSE_THRESHOLD;
    if (typeof input.salePrice !== 'number' || input.salePrice <= 0) {
      throw new Error('calculateHighValuePortion: salePrice는 0 초과여야 합니다. got=' + input.salePrice);
    }
    if (input.salePrice <= threshold) {
      throw new Error('calculateHighValuePortion: salePrice가 12억 임계 이하입니다. got=' + input.salePrice);
    }
    var allocationRatio = (input.salePrice - threshold) / input.salePrice;
    var taxableGain = Math.floor(input.transferGain * allocationRatio);
    return { taxableGain: taxableGain, allocationRatio: allocationRatio };
  }

  // 5-3. 장특공 표 1·표 2 룩업 호출 (명세서 §5-2·§5-3, v0.2.1 룩업 패턴)
  // 입력:  { taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse }
  // 출력:  { longTermDeduction, appliedDeductionTable, holdingRate, residenceRate, totalRate }
  function calculateLongTermDeduction(input) {
    var rs = getRules();
    var taxableGain = input.taxableGain;
    var holdingYears = input.holdingYears;
    var residenceYears = input.residenceYears;
    var is1Se1House = input.is1Se1House === true;
    var isHighValueHouse = input.isHighValueHouse === true;

    if (!Number.isInteger(holdingYears) || holdingYears < 0) {
      throw new Error('calculateLongTermDeduction: holdingYears는 0 이상의 정수여야 합니다. got=' + holdingYears);
    }
    if (!Number.isInteger(residenceYears) || residenceYears < 0) {
      throw new Error('calculateLongTermDeduction: residenceYears는 0 이상의 정수여야 합니다. got=' + residenceYears);
    }

    // (a) 표 적용 자격 판정
    var appliedDeductionTable;
    var holdingRate;
    var residenceRate;

    if (is1Se1House && isHighValueHouse) {
      // 1세대1주택 + 12억 초과 → 표 2 (보유 3년 이상 한정)
      if (holdingYears < 3) {
        return {
          longTermDeduction: 0,
          appliedDeductionTable: null,
          holdingRate: 0,
          residenceRate: 0,
          totalRate: 0
        };
      }
      appliedDeductionTable = 2;
      holdingRate = rs.findHoldingRate(holdingYears, rs.LONG_TERM_DEDUCTION_TABLE_2_HOLDING);
      residenceRate = rs.findResidenceRate(residenceYears, holdingYears, rs.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE);
    } else {
      // 그 외 (다주택 + 보유≥3년 또는 1세대1주택 비과세 통과 후 단계 4 진입)
      if (holdingYears < 3) {
        return {
          longTermDeduction: 0,
          appliedDeductionTable: null,
          holdingRate: 0,
          residenceRate: 0,
          totalRate: 0
        };
      }
      appliedDeductionTable = 1;
      holdingRate = rs.findHoldingRate(holdingYears, rs.LONG_TERM_DEDUCTION_TABLE_1);
      residenceRate = 0;
    }

    var totalRate = holdingRate + residenceRate;
    var longTermDeduction = Math.floor(taxableGain * totalRate);
    return {
      longTermDeduction: longTermDeduction,
      appliedDeductionTable: appliedDeductionTable,
      holdingRate: holdingRate,
      residenceRate: residenceRate,
      totalRate: totalRate
    };
  }

  // ==================================================================
  // 6. issueFlag 수집 (v0.2: 18종 + 자동 보정 2종, 명세서 §6 + 작업지시서 §5)
  // ==================================================================

  function collectIssueFlags(caseData, intermediates) {
    var rs;
    try { rs = getRules(); } catch (e) { return []; }

    var flags = [];
    var input = (intermediates && intermediates.input) ? intermediates.input : {};
    var transferGain = intermediates ? intermediates.transferGain : 0;
    var is1Se1House = intermediates ? intermediates.is1Se1House === true : false;
    var isHighValueHouse = intermediates ? intermediates.isHighValueHouse === true : false;
    var terminateAt2 = intermediates ? intermediates.terminateAt2 === true : false;
    var appliedDeductionTable = intermediates ? intermediates.appliedDeductionTable : null;
    var holdingYears = (intermediates && Number.isInteger(intermediates.holdingYears)) ? intermediates.holdingYears : null;
    var residenceYears = (intermediates && Number.isInteger(intermediates.residenceYears)) ? intermediates.residenceYears : null;
    var autoCorrections = (intermediates && Array.isArray(intermediates.autoCorrections)) ? intermediates.autoCorrections : [];

    var acqDate = input.acquisitionDate;
    var saleDate = input.saleDate;
    var salePrice = input.salePrice;
    var residenceMonths = input.residenceMonths;
    var ap = parseISODate(acqDate);

    var lawRefs = rs.LAW_REFS || {};
    var householdHouseCount = (caseData && Number.isInteger(caseData.householdHouseCount))
                                ? caseData.householdHouseCount : null;

    // ─── (1) v0.2 신규 5종 + 보조 3종 ─────────────────────────────

    // IS_1SE_1HOUSE
    if (is1Se1House) {
      flags.push({
        code: 'IS_1SE_1HOUSE',
        severity: 'info',
        message: '1세대1주택 비과세가 적용되었습니다 (보유 ' + holdingYears + '년, 거주 ' + residenceYears + '년).',
        lawRef: lawRefs.nonTaxation1Se1House || '소득세법 제89조 ①ⅲ, 시행령 제154조'
      });
    }

    // IS_HIGH_VALUE_HOUSE — 1세대1주택 + 12억 초과 안분 진입
    if (is1Se1House && isHighValueHouse) {
      flags.push({
        code: 'IS_HIGH_VALUE_HOUSE',
        severity: 'info',
        message: '양도가액 12억원 초과분에 안분 과세가 적용되었습니다.',
        lawRef: lawRefs.highValueHouse || '소득세법 제95조 ③, 시행령 제160조'
      });
    }

    // LONG_TERM_DEDUCTION_TABLE_1 / TABLE_2
    if (appliedDeductionTable === 1) {
      flags.push({
        code: 'LONG_TERM_DEDUCTION_TABLE_1',
        severity: 'info',
        message: '장기보유특별공제 표 1 적용 (보유 ' + holdingYears + '년).',
        lawRef: lawRefs.longTermDeductionTable1 || '소득세법 제95조 ② 표 1'
      });
    } else if (appliedDeductionTable === 2) {
      flags.push({
        code: 'LONG_TERM_DEDUCTION_TABLE_2',
        severity: 'info',
        message: '장기보유특별공제 표 2 적용 (보유 ' + holdingYears + '년 + 거주 ' + residenceYears + '년).',
        lawRef: lawRefs.longTermDeductionTable2 || '소득세법 제95조 ② 표 2'
      });
    }

    // ONE_TIME_2HOUSES_NOT_APPLIED
    if (caseData && caseData.isOneTimeTwoHouses === true) {
      flags.push({
        code: 'ONE_TIME_2HOUSES_NOT_APPLIED',
        severity: 'warning',
        message: '일시적 2주택 특례는 v0.2에서 미적용. 다주택 일반과세로 처리됩니다. v0.3에서 정확한 산정 예정입니다.',
        lawRef: '시행령 제155조 ①'
      });
    }

    // RESIDENCE_MONTHS_USER_INPUT — 항상 (거주기간 산정 사용자 책임 명시)
    flags.push({
      code: 'RESIDENCE_MONTHS_USER_INPUT',
      severity: 'info',
      message: '거주기간(residenceMonths)은 사용자 입력값을 그대로 사용합니다. 정확한 거주기간 산정은 사용자 책임입니다.',
      lawRef: '시행령 제154조 ⑥'
    });

    // RESIDENCE_EXEMPTION_NOT_HANDLED
    if (input.acquisitionRegulated === true &&
        Number.isInteger(residenceMonths) && residenceMonths < 24) {
      flags.push({
        code: 'RESIDENCE_EXEMPTION_NOT_HANDLED',
        severity: 'info',
        message: '거주요건 면제 사유(공익사업 수용 등)는 v0.2에서 미처리. 면제 사유 해당 시 별도 검토 필요.',
        lawRef: '시행령 제154조 ① 단서'
      });
    }

    // LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2
    if (is1Se1House && isHighValueHouse &&
        Number.isInteger(holdingYears) && holdingYears < 3) {
      flags.push({
        code: 'LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2',
        severity: 'info',
        message: '1세대1주택 12억 초과지만 보유 3년 미만이라 표 2 미적용 (장특공 0).',
        lawRef: '소득세법 제95조 ② 표 2'
      });
    }

    // ─── (2) v0.1 변경 5종 ────────────────────────────────────────

    // POSSIBLE_NON_TAXATION_1H1H — v0.2 발동조건 변경: 비과세 미적용 + 잠재 가능
    if (!is1Se1House && householdHouseCount === 1 &&
        Number.isInteger(holdingYears) && holdingYears >= 2 &&
        Number.isInteger(residenceMonths) && residenceMonths >= 24) {
      flags.push({
        code: 'POSSIBLE_NON_TAXATION_1H1H',
        severity: 'info',
        message: '1세대1주택 비과세 잠재 가능 케이스이나 본 산출에서는 미적용. 정확한 판정은 전문가 검토 필요.',
        lawRef: lawRefs.nonTaxation1Se1House || '소득세법 제89조'
      });
    }

    // HIGH_VALUE_HOUSE — v0.2 발동조건 변경: 비과세 미적용 + 12억 초과
    if (!is1Se1House && Number.isInteger(salePrice) && salePrice >= 1200000000) {
      flags.push({
        code: 'HIGH_VALUE_HOUSE',
        severity: 'info',
        message: '양도가액이 12억원 이상이지만 1세대1주택 비과세가 적용되지 않아 안분 미적용 (전체 과세).',
        lawRef: lawRefs.highValueHouse || '소득세법 제95조 ③'
      });
    }

    // OUT_OF_V01_SCOPE_REGULATED_AREA — v0.2 발동조건 축소: saleRegulated만
    if (input.saleRegulated === true) {
      flags.push({
        code: 'OUT_OF_V01_SCOPE_REGULATED_AREA',
        severity: 'warning',
        message: '양도 시점에 조정대상지역이 포함되어 있습니다. v0.2 일반과세로 진행. v0.3 중과 적용 후 정확한 세액 산출 예정.',
        lawRef: '소득세법 제104조 ⑦'
      });
    }

    // OUT_OF_V01_SCOPE_DATE — 그대로
    if (isValidISODate(saleDate) && saleDate < rs.APPLICABLE_SALE_DATE_FROM) {
      flags.push({
        code: 'OUT_OF_V01_SCOPE_DATE',
        severity: 'warning',
        message: '양도일이 적용 하한(' + rs.APPLICABLE_SALE_DATE_FROM + ') 이전입니다. v0.2 범위 외.',
        lawRef: '(v0.2 가정)'
      });
    }

    // UNREGISTERED_RATE_NOT_APPLIED — 항상 (v0.1 UNREGISTERED_ASSET_ASSUMED_FALSE 이름 변경)
    flags.push({
      code: 'UNREGISTERED_RATE_NOT_APPLIED',
      severity: 'info',
      message: '등기자산 가정으로 계산했습니다. 미등기양도자산은 별도 70% 세율 + 기본공제 배제.',
      lawRef: '소득세법 제104조 ① 제10호'
    });

    // ─── (3) v0.1 유지 5종 ────────────────────────────────────────

    // NECESSARY_EXPENSE_BREAKDOWN_MISSING — 항상
    flags.push({
      code: 'NECESSARY_EXPENSE_BREAKDOWN_MISSING',
      severity: 'info',
      message: '필요경비를 단일 필드로 입력했습니다. 자본적지출·양도비 분리 입력은 v0.3 예정.',
      lawRef: '소득세법 제97조'
    });

    // ACQUISITION_CAUSE_ASSUMED_PURCHASE — 항상
    flags.push({
      code: 'ACQUISITION_CAUSE_ASSUMED_PURCHASE',
      severity: 'info',
      message: '매매취득 가정으로 계산했습니다. 상속·증여 시 취득가액·취득일 산정 별도.',
      lawRef: '소득세법 제97조 ①'
    });

    // HOLDING_PERIOD_BOUNDARY — v0.2 확장: 1·2·3·15년 ±3일
    if (ap && isValidISODate(saleDate)) {
      var boundaries = Array.isArray(rs.HOLDING_PERIOD_BOUNDARY_YEARS)
                        ? rs.HOLDING_PERIOD_BOUNDARY_YEARS : [1, 2, 3, 15];
      var hit = false;
      for (var bi = 0; bi < boundaries.length; bi++) {
        var mark = addYearsMark(ap, boundaries[bi]);
        if (diffDaysAbs(saleDate, mark) <= 3) { hit = true; break; }
      }
      if (hit) {
        flags.push({
          code: 'HOLDING_PERIOD_BOUNDARY',
          severity: 'warning',
          message: '양도일이 보유기간 경계(1·2·3·15년)의 ±3일 이내입니다. 전문가 검토 권고.',
          lawRef: '시행령 제155조 단서, 제95조 ②'
        });
      }
    }

    // TRANSFER_LOSS_DETECTED — 그대로
    if (transferGain < 0) {
      flags.push({
        code: 'TRANSFER_LOSS_DETECTED',
        severity: 'info',
        message: '양도가액이 취득가액과 필요경비 합계보다 작습니다. 양도차손이 발생했으며, 과세표준은 0원으로 처리됩니다.',
        lawRef: '소득세법 제95조 ①'
      });
    }

    // ─── (4) 자동 보정 issueFlag (B-019) ─────────────────────────

    if (autoCorrections.indexOf('HOUSEHOLD_COUNT_INFERRED') >= 0) {
      flags.push({
        code: 'HOUSEHOLD_COUNT_INFERRED',
        severity: 'info',
        message: 'householdHouseCount가 입력에 없어 salePlan.candidateHouseIds.length로 자동 추정했습니다.',
        lawRef: '(v0.2 자동 보정)'
      });
    }
    if (autoCorrections.indexOf('RESIDENCE_MONTHS_DEFAULTED_ZERO') >= 0) {
      flags.push({
        code: 'RESIDENCE_MONTHS_DEFAULTED_ZERO',
        severity: 'info',
        message: 'residenceMonths가 입력에 없어 0으로 자동 보정했습니다.',
        lawRef: '(v0.2 자동 보정)'
      });
    }

    return flags;
  }

  // ==================================================================
  // 7. 메인 — calculateSingleTransfer (v0.2 13단계 + 비과세/안분/장특공 분기)
  // ==================================================================

  function calculateSingleTransfer(caseData, houseId) {
    var rs = getRules();
    ensureV02Rules(rs);

    var validation = validateCaseData(caseData);
    if (!validation.ok) {
      throw new Error('tax_engine: caseData 검증 실패: ' + validation.errors.join(' | '));
    }

    var corrected = validation.correctedCaseData;
    var house = pickHouse(corrected, houseId);
    var input = normalizeInput(corrected, house);

    // 1단계
    var transferGain = computeTransferGain(input);

    // 단계 2 — 1세대1주택 비과세 결정
    var exemption = check1Se1HouseExemption({
      householdHouseCount:  corrected.householdHouseCount,
      acquisitionDate:      input.acquisitionDate,
      saleDate:             input.saleDate,
      acquisitionRegulated: input.acquisitionRegulated,
      residenceMonths:      input.residenceMonths,
      salePrice:            input.salePrice
    });
    var is1Se1House     = exemption.is1Se1House;
    var isHighValueHouse = exemption.isHighValueHouse;
    var terminateAt2    = exemption.terminateAt2;
    var holdingYears    = exemption.holdingYears;
    var residenceYears  = exemption.residenceYears;

    // 단계 2 결과 — taxableGainAfterNT
    var taxableGainAfterNT, nonTaxableGain;
    if (terminateAt2) {
      taxableGainAfterNT = 0;
      nonTaxableGain = transferGain;
    } else {
      taxableGainAfterNT = transferGain;
      nonTaxableGain = 0;
    }

    // 단계 3 — 안분 (12억 초과 1세대1주택만)
    var taxableGain, allocationRatio;
    if (terminateAt2) {
      taxableGain = 0;
      allocationRatio = 1.0;
    } else if (isHighValueHouse) {
      var portion = calculateHighValuePortion({
        transferGain: taxableGainAfterNT,
        salePrice:    input.salePrice
      });
      taxableGain = portion.taxableGain;
      allocationRatio = portion.allocationRatio;
    } else {
      taxableGain = taxableGainAfterNT;
      allocationRatio = 1.0;
    }

    // 단계 4 — 장특공 (terminateAt2 시 0/null + 양도차손 시 0)
    // taxableGain<0이면 의미 없는 음수 공제를 회피하여 0 처리 (v0.1 호환).
    var ltdResult;
    if (terminateAt2 || taxableGain < 0) {
      ltdResult = {
        longTermDeduction: 0,
        appliedDeductionTable: null,
        holdingRate: 0,
        residenceRate: 0,
        totalRate: 0
      };
    } else {
      ltdResult = calculateLongTermDeduction({
        taxableGain:      taxableGain,
        holdingYears:     holdingYears,
        residenceYears:   residenceYears,
        is1Se1House:      is1Se1House,
        isHighValueHouse: isHighValueHouse
      });
    }
    var longTermDeduction = ltdResult.longTermDeduction;

    // 단계 5~13 (terminateAt2 시 후속 단계 0/null 정책, 모듈 스펙 §4-2-1)
    var capitalGainIncome, basicDeduction, taxBase;
    var holdingPeriodBranch, appliedRateInternal;
    var calculatedTax, localIncomeTax, totalTax, netAfterTaxSaleAmount;

    if (terminateAt2) {
      capitalGainIncome   = 0;
      basicDeduction      = 0;
      taxBase             = 0;
      holdingPeriodBranch = determineHoldingPeriodBranch(input.acquisitionDate, input.saleDate);
      appliedRateInternal = null;
      calculatedTax       = 0;
      localIncomeTax      = 0;
      totalTax            = 0;
      netAfterTaxSaleAmount = input.salePrice;
    } else {
      capitalGainIncome     = computeCapitalGainIncome(taxableGain, longTermDeduction);
      basicDeduction        = computeBasicDeduction(input.basicDeductionUsed);
      taxBase               = computeTaxBase(capitalGainIncome, basicDeduction);
      holdingPeriodBranch   = determineHoldingPeriodBranch(input.acquisitionDate, input.saleDate);
      appliedRateInternal   = determineAppliedRate(holdingPeriodBranch, taxBase);
      calculatedTax         = computeCalculatedTax(taxBase, appliedRateInternal);
      localIncomeTax        = computeLocalIncomeTax(calculatedTax);
      totalTax              = computeTotalTax(calculatedTax, localIncomeTax);
      netAfterTaxSaleAmount = computeNetAfterTaxSaleAmount(input.salePrice, totalTax);
    }
    var effectiveTaxRate = computeEffectiveTaxRate(totalTax, input.salePrice);

    // issueFlag 수집
    var issueFlags = collectIssueFlags(corrected, {
      input: input,
      transferGain: transferGain,
      holdingPeriodBranch: holdingPeriodBranch,
      appliedRate: appliedRateInternal,
      is1Se1House: is1Se1House,
      isHighValueHouse: isHighValueHouse,
      terminateAt2: terminateAt2,
      appliedDeductionTable: ltdResult.appliedDeductionTable,
      holdingYears: holdingYears,
      residenceYears: residenceYears,
      autoCorrections: validation.autoCorrections
    });

    // 출력 appliedRate (terminateAt2 시 null, 모듈 스펙 §4-2-1)
    var appliedRateOut = null;
    if (appliedRateInternal !== null) {
      appliedRateOut = {
        type:         appliedRateInternal.type,
        bracket:      appliedRateInternal.bracket,
        label:        appliedRateInternal.label,
        marginalRate: appliedRateInternal.marginalRate,
        baseTax:      appliedRateInternal.baseTax
      };
    }

    return {
      caseId:        (corrected && typeof corrected.caseId === 'string')
                       ? corrected.caseId
                       : ('CASE-' + (input.houseId || 'A')),
      ruleVersion:   rs.RULE_VERSION,
      engineVersion: ENGINE_VERSION,
      timestamp:     new Date().toISOString(),

      inputsEcho: {
        salePrice:            input.salePrice,
        acquisitionPrice:     input.acquisitionPrice,
        necessaryExpense:     input.necessaryExpense,
        acquisitionDate:      input.acquisitionDate,
        saleDate:             input.saleDate,
        basicDeductionUsed:   input.basicDeductionUsed,
        acquisitionRegulated: input.acquisitionRegulated,
        saleRegulated:        input.saleRegulated,
        residenceMonths:      input.residenceMonths,
        livingNow:            input.livingNow,
        candidateHouseCount:  input.candidateHouseCount,
        houseId:              input.houseId,
        // v0.2 신규 echo
        householdHouseCount:  corrected.householdHouseCount,
        isOneTimeTwoHouses:   corrected.isOneTimeTwoHouses === true
      },

      steps: {
        // v0.1 13개 필드 (이름·타입 유지)
        transferGain:          transferGain,
        taxableGain:           taxableGain,
        nonTaxableGain:        nonTaxableGain,
        longTermDeduction:     longTermDeduction,
        capitalGainIncome:     capitalGainIncome,
        basicDeduction:        basicDeduction,
        taxBase:               taxBase,
        holdingPeriodBranch:   holdingPeriodBranch,
        appliedRate:           appliedRateOut,
        calculatedTax:         calculatedTax,
        localIncomeTax:        localIncomeTax,
        totalTax:              totalTax,
        netAfterTaxSaleAmount: netAfterTaxSaleAmount,
        // v0.2 신규 10개 필드 (모듈 스펙 §4-2)
        is1Se1House:           is1Se1House,
        isHighValueHouse:      isHighValueHouse,
        allocationRatio:       allocationRatio,
        appliedDeductionTable: ltdResult.appliedDeductionTable,
        holdingYears:          holdingYears,
        residenceYears:        residenceYears,
        holdingRate:           ltdResult.holdingRate,
        residenceRate:         ltdResult.residenceRate,
        totalRate:             ltdResult.totalRate,
        terminateAt2:          terminateAt2
      },

      // B-008 보강 — 시나리오 비교 지표 사전 노출
      metrics: {
        totalTax:              totalTax,
        netAfterTaxSaleAmount: netAfterTaxSaleAmount,
        effectiveTaxRate:      terminateAt2 ? 0 : effectiveTaxRate
      },

      issueFlags:      issueFlags,
      warnings:        validation.warnings,
      autoCorrections: validation.autoCorrections,

      // v0.1 array 형식 유지 + v0.2 신규 4건 추가
      lawRefs: [
        rs.LAW_REFS.progressiveRate,
        rs.LAW_REFS.transferTaxRate,
        rs.LAW_REFS.basicDeduction,
        rs.LAW_REFS.localIncomeTax,
        rs.LAW_REFS.nonTaxation1Se1House,
        rs.LAW_REFS.highValueHouse,
        rs.LAW_REFS.longTermDeductionTable1,
        rs.LAW_REFS.longTermDeductionTable2
      ]
    };
  }

  // ==================================================================
  // 8. 자체검증 — selfTest (v0.1 sanity 3건 + v0.2 sanity 3건 보강)
  // ==================================================================

  function _buildSanityCaseData(fields) {
    return {
      baseYear: 2026,
      householdMembers: 1,
      householdHouseCount: (typeof fields.householdHouseCount === 'number')
                              ? fields.householdHouseCount : 2,
      isOneTimeTwoHouses: fields.isOneTimeTwoHouses === true,
      basicDeductionUsed: fields.basicDeductionUsed === true,
      houses: [{
        id: 'A',
        nickname: 'sanity',
        location: '',
        acquisitionDate:      fields.acquisitionDate,
        acquisitionPrice:     fields.acquisitionPrice,
        necessaryExpense:     fields.necessaryExpense,
        acquisitionRegulated: fields.acquisitionRegulated === true,
        residenceMonths:      Number.isInteger(fields.residenceMonths) ? fields.residenceMonths : 0,
        livingNow:            fields.livingNow === true,
        expectedSaleDate:     fields.expectedSaleDate,
        expectedSalePrice:    fields.expectedSalePrice,
        saleRegulated:        false
      }],
      salePlan: {
        targetSaleCount: 1,
        candidateHouseIds: ['A'],
        fixedSaleHouseIds: ['A'],
        excludedHouseIds: [],
        allowSystemToChooseSaleTargets: false,
        allowYearSplitting: false,
        targetSaleYears: [2026]
      }
    };
  }

  function selfTest() {
    var rulesSt;
    try {
      rulesSt = getRules().selfTest();
    } catch (e) {
      return {
        ok: false,
        taxRulesSelfTest: { ok: false, error: e.message },
        sanityChecks: null
      };
    }
    if (!rulesSt.ok) {
      return { ok: false, taxRulesSelfTest: rulesSt, sanityChecks: null };
    }

    var sanitySpecs = [
      // ── v0.1 sanity 3건 (다주택 명시로 비과세 회피, v0.2 단계 4 적용 후 정답) ───
      {
        // TC-001: 다주택 + 보유 6년(표 1 12%) → longTermDeduction 34.8M, taxBase 252.7M, totalTax 83,694,600
        id: 'TC-001', expectedTotalTax: 83694600, expectedTaxBase: 252700000,
        fields: {
          householdHouseCount: 2,
          acquisitionDate:   '2020-01-15', acquisitionPrice:  500000000, necessaryExpense:  10000000,
          expectedSaleDate:  '2026-08-31', expectedSalePrice: 800000000, basicDeductionUsed: false
        }
      },
      {
        // TC-003: 양도차손 — 단계 4 스킵 (음수 회피) → totalTax 0
        id: 'TC-003', expectedTotalTax: 0, expectedTaxBase: 0,
        fields: {
          householdHouseCount: 2,
          acquisitionDate:   '2020-06-01', acquisitionPrice:  500000000, necessaryExpense:  10000000,
          expectedSaleDate:  '2026-09-30', expectedSalePrice: 480000000, basicDeductionUsed: false
        }
      },
      {
        // TC-005: 다주택 + 보유 8년(표 1 16%) → longTermDeduction 2.64M, taxBase 11.36M, totalTax 749,760
        id: 'TC-005', expectedTotalTax: 749760, expectedTaxBase: 11360000,
        fields: {
          householdHouseCount: 2,
          acquisitionDate:   '2018-03-01', acquisitionPrice:  200000000, necessaryExpense:         0,
          expectedSaleDate:  '2026-07-15', expectedSalePrice: 216500000, basicDeductionUsed: false
        }
      },
      // ── v0.2 sanity 3건 (TC-006/008/010, 작업지시서 §11-2-9) ──
      {
        id: 'TC-006', expectedTotalTax: 0, expectedTaxBase: 0,
        fields: {
          householdHouseCount: 1,
          acquisitionDate:   '2021-04-30', acquisitionPrice:  600000000, necessaryExpense:  15000000,
          expectedSaleDate:  '2026-08-31', expectedSalePrice: 1000000000, basicDeductionUsed: false,
          residenceMonths:   60, livingNow: true
        }
      },
      {
        id: 'TC-008', expectedTotalTax: 130878000, expectedTaxBase: 362300000,
        fields: {
          householdHouseCount: 2,
          acquisitionDate:   '2014-05-20', acquisitionPrice:  500000000, necessaryExpense:  20000000,
          expectedSaleDate:  '2026-08-15', expectedSalePrice: 1000000000, basicDeductionUsed: false,
          residenceMonths:   0
        }
      },
      {
        id: 'TC-010', expectedTotalTax: 122826000, expectedTaxBase: 344000000,
        fields: {
          householdHouseCount: 2,
          isOneTimeTwoHouses: true,
          acquisitionDate:   '2021-05-20', acquisitionPrice:  600000000, necessaryExpense:  15000000,
          expectedSaleDate:  '2026-08-31', expectedSalePrice: 1000000000, basicDeductionUsed: false,
          residenceMonths:   0
        }
      }
    ];

    var checks = [];
    var allOk = true;
    for (var i = 0; i < sanitySpecs.length; i++) {
      var s = sanitySpecs[i];
      try {
        var r = calculateSingleTransfer(_buildSanityCaseData(s.fields));
        var thisOk = r.steps.totalTax === s.expectedTotalTax &&
                     r.steps.taxBase  === s.expectedTaxBase;
        checks.push({
          id:                s.id,
          expectedTotalTax:  s.expectedTotalTax,
          actualTotalTax:    r.steps.totalTax,
          expectedTaxBase:   s.expectedTaxBase,
          actualTaxBase:     r.steps.taxBase,
          ok:                thisOk
        });
        if (!thisOk) allOk = false;
      } catch (e) {
        checks.push({ id: s.id, error: e.message, ok: false });
        allOk = false;
      }
    }

    return {
      ok: allOk,
      taxRulesSelfTest: rulesSt,
      sanityChecks: { ok: allOk, checks: checks }
    };
  }

  // ==================================================================
  // 9. 노출 — window.TaxOpt.taxEngine
  // ==================================================================

  global.TaxOpt = global.TaxOpt || {};
  global.TaxOpt.taxEngine = {
    // 메타 (1종)
    ENGINE_VERSION: ENGINE_VERSION,
    // 메인 (1종)
    calculateSingleTransfer: calculateSingleTransfer,
    // 0단계 (1종)
    validateCaseData: validateCaseData,
    // 1~13단계 (13종)
    computeTransferGain:           computeTransferGain,
    applyNonTaxation:              applyNonTaxation,
    applyHighValueAllocation:      applyHighValueAllocation,
    computeLongTermDeduction:      computeLongTermDeduction,
    computeCapitalGainIncome:      computeCapitalGainIncome,
    computeBasicDeduction:         computeBasicDeduction,
    computeTaxBase:                computeTaxBase,
    determineHoldingPeriodBranch:  determineHoldingPeriodBranch,
    determineAppliedRate:          determineAppliedRate,
    computeCalculatedTax:          computeCalculatedTax,
    computeLocalIncomeTax:         computeLocalIncomeTax,
    computeTotalTax:               computeTotalTax,
    computeNetAfterTaxSaleAmount:  computeNetAfterTaxSaleAmount,
    // 보강 + issueFlag (2종)
    computeEffectiveTaxRate:       computeEffectiveTaxRate,
    collectIssueFlags:             collectIssueFlags,
    // v0.2 신규 보조 (3종)
    check1Se1HouseExemption:       check1Se1HouseExemption,
    calculateHighValuePortion:     calculateHighValuePortion,
    calculateLongTermDeduction:    calculateLongTermDeduction,
    // v0.2 신규 보조 헬퍼 (1종)
    computeHoldingYears:           computeHoldingYears,
    // 자체검증 (1종)
    selfTest: selfTest
  };

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));
