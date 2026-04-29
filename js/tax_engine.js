/**
 * tax_engine.js
 *
 * TaxOpt 계산 엔진 v0.1.1 — 13단계 양도소득세 계산 파이프라인
 *
 * 책임:
 *   1) caseData 입력을 받아 0~13단계 + B-008 보강 + issueFlag 수집을 수행한다.
 *   2) 모듈 스펙 §4의 taxResult 객체를 반환한다.
 *   3) selfTest()로 부트스트랩 시점 자체검증(룰 무결성 + sanity 3건)을 수행한다.
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
 *   window.TaxOpt.taxRules (tax_rules.js, 선행 로드 필수)
 *
 * 참조 문서:
 *   - 명세서:        docs/v0.1/01_calc_engine_spec.md (§2 13단계, §3 보유기간, §4 세율, §5 절사, §7 issueFlag, §8 검증)
 *   - 모듈 스펙:     docs/v0.1/modules/tax_engine.md
 *   - 작업지시서:    docs/05_code_work_orders/02_tax_engine.md
 *   - 입력 스키마:   docs/v0.1/03_input_schema.md
 *   - 골든셋:        docs/v0.1/06_test_cases.md
 *   - 의사결정:      docs/99_decision_log.md (#5, #8, #9 v9)
 *
 * 규약:
 *   - 모든 금액은 원 단위 정수.
 *   - 절사는 명세서 §5 정책에 따라 10단계(calculatedTax)·11단계(localIncomeTax)에만 Math.floor 적용.
 *   - effectiveTaxRate는 비율이므로 절사하지 않는다.
 *   - caseData 입력 객체를 변경하지 않는다(순수 함수).
 *   - DOM 접근 없음. 외부 라이브러리 의존 없음.
 *   - ES6 module(import/export) 미사용.
 */
(function (global) {
  'use strict';

  // ==================================================================
  // 0. 메타데이터
  // ==================================================================

  var ENGINE_VERSION = 'v0.1.1-post-20260510';

  // tax_rules 의존을 호출 시점에 해소하기 위한 헬퍼 (모듈 스펙 §8-2 부트스트랩 가드)
  function getRules() {
    if (!global.TaxOpt || !global.TaxOpt.taxRules) {
      throw new Error('tax_engine: tax_rules.js가 먼저 로드되어야 합니다.');
    }
    return global.TaxOpt.taxRules;
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

  // 보유기간 경계 ±3일 판정에서만 Date 사용 (모듈 스펙 §5-8, 작업지시서 §3-8 권고).
  // 다른 단계의 동월동일 비교는 절대 Date를 사용하지 않는다.
  function diffDaysAbs(isoA, isoB) {
    var a = Date.parse(isoA + 'T00:00:00Z');
    var b = Date.parse(isoB + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.abs((a - b) / 86400000);
  }

  // ==================================================================
  // 2. House 선택 + 단축형 input 매핑 (모듈 스펙 §3-1, §3-2)
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
      // issueFlag 판정용 보존
      acquisitionRegulated: house.acquisitionRegulated === true,
      saleRegulated:        house.saleRegulated === true,
      residenceMonths:      house.residenceMonths,
      livingNow:            house.livingNow === true,
      candidateHouseCount:  candidateCount,
      houseId:              house.id
    };
  }

  // ==================================================================
  // 3. 0단계 — validateCaseData (명세서 §8, 모듈 스펙 §5-0)
  // ==================================================================

  function validateCaseData(caseData) {
    var errors = [];
    var warnings = [];

    if (!caseData || typeof caseData !== 'object') {
      errors.push('caseData가 객체가 아닙니다.');
      return { ok: false, errors: errors, warnings: warnings };
    }
    if (!Array.isArray(caseData.houses) || caseData.houses.length === 0) {
      errors.push('houses 배열이 비어 있습니다.');
      return { ok: false, errors: errors, warnings: warnings };
    }

    var house;
    try {
      house = pickHouse(caseData, undefined);
    } catch (e) {
      errors.push(e.message);
      return { ok: false, errors: errors, warnings: warnings };
    }

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

    // 에러가 없는 경우에만 경고 항목을 평가 (에러가 있으면 호출 측이 어차피 throw)
    if (errors.length === 0) {
      // 7. saleDate.year === baseYear (권고)
      var saleYear = parseInt(house.expectedSaleDate.substring(0, 4), 10);
      if (Number.isInteger(caseData.baseYear) && saleYear !== caseData.baseYear) {
        warnings.push('expectedSaleDate.year(' + saleYear +
                      ')와 baseYear(' + caseData.baseYear + ')가 다릅니다.');
      }
      // 8. saleDate ≥ APPLICABLE_SALE_DATE_FROM
      var floorDate = '2026-05-10';
      try { floorDate = getRules().APPLICABLE_SALE_DATE_FROM; } catch (e) { /* 부트스트랩 단계에서는 fallback */ }
      if (house.expectedSaleDate < floorDate) {
        warnings.push('expectedSaleDate(' + house.expectedSaleDate +
                      ')가 v0.1 적용 하한(' + floorDate + ') 이전입니다.');
      }
      // 9. acquisitionRegulated || saleRegulated
      if (house.acquisitionRegulated === true || house.saleRegulated === true) {
        warnings.push('취득·양도 시점 중 조정대상지역이 포함되어 있습니다 (v0.1 일반과세로 계산).');
      }
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  // ==================================================================
  // 4. 13단계 파이프라인 함수 (모듈 스펙 §5)
  // ==================================================================

  // 1단계: 양도차익
  function computeTransferGain(input) {
    return input.salePrice - input.acquisitionPrice - input.necessaryExpense;
  }

  // 2단계: 비과세 (v0.1 passthrough, 모듈 스펙 §5-2)
  function applyNonTaxation(transferGain, _caseData) {
    return transferGain;
  }

  // 3단계: 고가주택 안분 (v0.1 passthrough, 모듈 스펙 §5-3)
  function applyHighValueAllocation(taxableGain, _caseData) {
    return taxableGain;
  }

  // 4단계: 장기보유특별공제 (v0.1 무조건 0, 모듈 스펙 §5-4)
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
  // 주의: acquisitionDate가 2/29인 경우 oneYearMark="YYYY-02-29"가 존재하지 않는 날짜.
  //   v0.1 골든셋에는 해당 케이스가 없어 문자열 비교로 처리. v0.2에서 명시적 윤년 처리 검토 (B-009 권장).
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
    // basic
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
  // 5. issueFlag 수집 (10종, 명세서 §7 + 작업지시서 §5)
  // ==================================================================

  function collectIssueFlags(caseData, intermediates) {
    var rs = getRules();
    var flags = [];

    var input = intermediates && intermediates.input ? intermediates.input : {};
    var transferGain        = intermediates ? intermediates.transferGain : 0;
    var acqDate             = input.acquisitionDate;
    var saleDate            = input.saleDate;
    var salePrice           = input.salePrice;
    var residenceMonths     = input.residenceMonths;
    var candidateHouseCount = input.candidateHouseCount;
    var ap = parseISODate(acqDate);

    // (1) LONG_TERM_DEDUCTION_NOT_APPLIED — 보유기간 ≥ 3년 (동월동일 비교)
    if (ap && isValidISODate(saleDate)) {
      var threeYearMark = addYearsMark(ap, 3);
      if (saleDate >= threeYearMark) {
        flags.push({
          code: 'LONG_TERM_DEDUCTION_NOT_APPLIED',
          severity: 'info',
          message: '보유기간이 3년 이상입니다. v0.1은 장기보유특별공제 미적용. v0.2에서 정확한 세액 산출 예정.',
          lawRef: '소득세법 제95조 ②'
        });
      }
    }

    // (2) POSSIBLE_NON_TAXATION_1H1H — 보유 ≥ 2년 + residenceMonths ≥ 24 + 후보 단일
    if (ap && isValidISODate(saleDate)) {
      var twoYearMark2 = addYearsMark(ap, 2);
      if (saleDate >= twoYearMark2 &&
          Number.isInteger(residenceMonths) && residenceMonths >= 24 &&
          candidateHouseCount === 1) {
        flags.push({
          code: 'POSSIBLE_NON_TAXATION_1H1H',
          severity: 'info',
          message: '1세대1주택 비과세 검토 가능 케이스입니다. v0.2에서 정확한 판정 예정.',
          lawRef: '소득세법 제89조'
        });
      }
    }

    // (3) HIGH_VALUE_HOUSE — salePrice ≥ 12억
    if (Number.isInteger(salePrice) && salePrice >= 1200000000) {
      flags.push({
        code: 'HIGH_VALUE_HOUSE',
        severity: 'info',
        message: '양도가액이 12억원 이상입니다. v0.1은 고가주택 12억 초과분 과세 미적용. v0.2에서 정확한 세액 산출 예정.',
        lawRef: '소득세법 제95조 ③'
      });
    }

    // (4) OUT_OF_V01_SCOPE_REGULATED_AREA
    if (input.acquisitionRegulated === true || input.saleRegulated === true) {
      flags.push({
        code: 'OUT_OF_V01_SCOPE_REGULATED_AREA',
        severity: 'warning',
        message: '취득·양도 시점 중 조정대상지역이 포함되어 있습니다. v0.1 범위 외 (일반과세로 진행). v0.2 중과 적용 후 정확한 세액 산출 예정.',
        lawRef: '소득세법 제104조 ⑦'
      });
    }

    // (5) OUT_OF_V01_SCOPE_DATE
    if (isValidISODate(saleDate) && saleDate < rs.APPLICABLE_SALE_DATE_FROM) {
      flags.push({
        code: 'OUT_OF_V01_SCOPE_DATE',
        severity: 'warning',
        message: '양도일이 v0.1 적용 하한(' + rs.APPLICABLE_SALE_DATE_FROM + ') 이전입니다. v0.1 범위 외.',
        lawRef: '(v0.1 가정)'
      });
    }

    // (6) NECESSARY_EXPENSE_BREAKDOWN_MISSING — 항상
    flags.push({
      code: 'NECESSARY_EXPENSE_BREAKDOWN_MISSING',
      severity: 'info',
      message: '필요경비를 단일 필드로 입력했습니다. 자본적지출·양도비 분리 입력은 v0.2 예정.',
      lawRef: '소득세법 제97조'
    });

    // (7) UNREGISTERED_ASSET_ASSUMED_FALSE — 항상
    flags.push({
      code: 'UNREGISTERED_ASSET_ASSUMED_FALSE',
      severity: 'info',
      message: '등기자산 가정으로 계산했습니다. 미등기양도자산은 별도 70% 세율 + 기본공제 배제.',
      lawRef: '소득세법 제104조 ① 제10호'
    });

    // (8) ACQUISITION_CAUSE_ASSUMED_PURCHASE — 항상
    flags.push({
      code: 'ACQUISITION_CAUSE_ASSUMED_PURCHASE',
      severity: 'info',
      message: '매매취득 가정으로 계산했습니다. 상속·증여 시 취득가액·취득일 산정 별도.',
      lawRef: '소득세법 제97조 ①'
    });

    // (9) HOLDING_PERIOD_BOUNDARY — saleDate가 1년/2년 동월동일 마크의 ±3일 이내
    if (ap && isValidISODate(saleDate)) {
      var oneMark = addYearsMark(ap, 1);
      var twoMark = addYearsMark(ap, 2);
      if (diffDaysAbs(saleDate, oneMark) <= 3 || diffDaysAbs(saleDate, twoMark) <= 3) {
        flags.push({
          code: 'HOLDING_PERIOD_BOUNDARY',
          severity: 'warning',
          message: '양도일이 보유기간 1년 또는 2년 경계의 ±3일 이내입니다. 전문가 검토 권고.',
          lawRef: '소득세법 제95조 ④'
        });
      }
    }

    // (10) TRANSFER_LOSS_DETECTED
    if (transferGain < 0) {
      flags.push({
        code: 'TRANSFER_LOSS_DETECTED',
        severity: 'info',
        message: '양도가액이 취득가액과 필요경비 합계보다 작습니다. 양도차손이 발생했으며, 과세표준은 0원으로 처리됩니다.',
        lawRef: '(v0.1 처리)'
      });
    }

    return flags;
  }

  // ==================================================================
  // 6. 메인 — calculateSingleTransfer (모듈 스펙 §3, §4, §5-15)
  // ==================================================================

  function calculateSingleTransfer(caseData, houseId) {
    var rs = getRules(); // 부트스트랩 가드 (모듈 스펙 §8-2)

    var validation = validateCaseData(caseData);
    if (!validation.ok) {
      throw new Error('tax_engine: caseData 검증 실패: ' + validation.errors.join(' | '));
    }

    var house = pickHouse(caseData, houseId);
    var input = normalizeInput(caseData, house);

    // 1~13단계 파이프라인
    var transferGain          = computeTransferGain(input);
    var taxableGainAfterNT    = applyNonTaxation(transferGain, caseData);
    var taxableGain           = applyHighValueAllocation(taxableGainAfterNT, caseData);
    var longTermDeduction     = computeLongTermDeduction(taxableGain, caseData);
    var capitalGainIncome     = computeCapitalGainIncome(taxableGain, longTermDeduction);
    var basicDeduction        = computeBasicDeduction(input.basicDeductionUsed);
    var taxBase               = computeTaxBase(capitalGainIncome, basicDeduction);
    var holdingPeriodBranch   = determineHoldingPeriodBranch(input.acquisitionDate, input.saleDate);
    var appliedRateInternal   = determineAppliedRate(holdingPeriodBranch, taxBase);
    var calculatedTax         = computeCalculatedTax(taxBase, appliedRateInternal);
    var localIncomeTax        = computeLocalIncomeTax(calculatedTax);
    var totalTax              = computeTotalTax(calculatedTax, localIncomeTax);
    var netAfterTaxSaleAmount = computeNetAfterTaxSaleAmount(input.salePrice, totalTax);
    var effectiveTaxRate      = computeEffectiveTaxRate(totalTax, input.salePrice);

    // issueFlag 수집
    var issueFlags = collectIssueFlags(caseData, {
      input: input,
      transferGain: transferGain,
      holdingPeriodBranch: holdingPeriodBranch,
      appliedRate: appliedRateInternal
    });

    // 출력 appliedRate (모듈 스펙 §4-3 — lowerBound는 내부 사용 한정)
    var appliedRateOut = {
      type:         appliedRateInternal.type,
      bracket:      appliedRateInternal.bracket,
      label:        appliedRateInternal.label,
      marginalRate: appliedRateInternal.marginalRate,
      baseTax:      appliedRateInternal.baseTax
    };

    return {
      caseId:        (caseData && typeof caseData.caseId === 'string')
                       ? caseData.caseId
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
        houseId:              input.houseId
      },

      steps: {
        transferGain:          transferGain,
        taxableGain:           taxableGain,
        longTermDeduction:     longTermDeduction,
        capitalGainIncome:     capitalGainIncome,
        basicDeduction:        basicDeduction,
        taxBase:               taxBase,
        holdingPeriodBranch:   holdingPeriodBranch,
        appliedRate:           appliedRateOut,
        calculatedTax:         calculatedTax,
        localIncomeTax:        localIncomeTax,
        totalTax:              totalTax,
        netAfterTaxSaleAmount: netAfterTaxSaleAmount
      },

      // B-008 보강 — 시나리오 비교 지표 사전 노출
      metrics: {
        totalTax:              totalTax,
        netAfterTaxSaleAmount: netAfterTaxSaleAmount,
        effectiveTaxRate:      effectiveTaxRate
      },

      issueFlags: issueFlags,
      warnings:   validation.warnings,

      lawRefs: [
        '소득세법 제55조 제1항',
        '소득세법 제95조',
        '소득세법 제97조',
        '소득세법 제103조',
        '소득세법 제104조 제1항',
        '지방세법 제103조의3'
      ]
    };
  }

  // ==================================================================
  // 7. 자체검증 — selfTest (모듈 스펙 §6-1)
  // ==================================================================

  // sanity 체크용 caseData 빌더 (TC-001/003/005 입력)
  function _buildSanityCaseData(fields) {
    return {
      baseYear: 2026,
      householdMembers: 1,
      basicDeductionUsed: fields.basicDeductionUsed === true,
      houses: [{
        id: 'A',
        nickname: 'sanity',
        location: '',
        acquisitionDate:      fields.acquisitionDate,
        acquisitionPrice:     fields.acquisitionPrice,
        necessaryExpense:     fields.necessaryExpense,
        acquisitionRegulated: false,
        residenceMonths:      0,
        livingNow:            false,
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
      {
        id: 'TC-001', expectedTotalTax: 98241000, expectedTaxBase: 287500000,
        fields: {
          acquisitionDate:   '2020-01-15', acquisitionPrice:  500000000, necessaryExpense:  10000000,
          expectedSaleDate:  '2026-08-31', expectedSalePrice: 800000000, basicDeductionUsed: false
        }
      },
      {
        id: 'TC-003', expectedTotalTax: 0, expectedTaxBase: 0,
        fields: {
          acquisitionDate:   '2020-06-01', acquisitionPrice:  500000000, necessaryExpense:  10000000,
          expectedSaleDate:  '2026-09-30', expectedSalePrice: 480000000, basicDeductionUsed: false
        }
      },
      {
        id: 'TC-005', expectedTotalTax: 924000, expectedTaxBase: 14000000,
        fields: {
          acquisitionDate:   '2018-03-01', acquisitionPrice:  200000000, necessaryExpense:         0,
          expectedSaleDate:  '2026-07-15', expectedSalePrice: 216500000, basicDeductionUsed: false
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
  // 8. 노출 — window.TaxOpt.taxEngine
  // ==================================================================

  global.TaxOpt = global.TaxOpt || {};
  global.TaxOpt.taxEngine = {
    // 메타
    ENGINE_VERSION: ENGINE_VERSION,
    // 메인
    calculateSingleTransfer: calculateSingleTransfer,
    // 0단계
    validateCaseData: validateCaseData,
    // 1~13단계
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
    // 보강 + issueFlag
    computeEffectiveTaxRate:       computeEffectiveTaxRate,
    collectIssueFlags:             collectIssueFlags,
    // 자체검증
    selfTest: selfTest
  };

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));
