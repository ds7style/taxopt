/**
 * scenario_engine.js v0.3.0-C
 *
 * TaxOpt v0.3-C 시나리오 엔진 — 5/7 KAIST CAIO 발표 TC-S06 라이브 시연 본문.
 *
 * 본 모듈 단일 책임:
 *   1) generateSaleOrderScenarios(houses) — 양도 순서 6 순열 생성 (3! = 6)
 *   2) simulateScenarioWithStateTransition(caseData, saleOrder) — 상태전이 시뮬레이션
 *      (양도 1번째 → 2번째 → 3번째, householdHouseCount + basicDeductionUsed 갱신)
 *   3) runScenarios(caseData) — 6 시나리오 일괄 시뮬레이션 + rank 산출
 *   4) rankScenarios(scenarios) — sumNetAfterTaxSaleAmount 내림차순 정렬
 *
 * 의존:
 *   - window.TaxOpt.taxRules  (tax_rules.js v0.3-B 선행 로드 필수)
 *   - window.TaxOpt.taxEngine (tax_engine.js v0.3-B 선행 로드 필수)
 *
 * 본 모듈은 tax_engine.js + tax_rules.js 본문 변경 0건. 회귀 안전성 100% 보존.
 *
 * 작업지시서 v0.3-C §6 본문 (`docs/05_code_work_orders/v0_3_C/08_v0_3_C.md`).
 * 의사결정 로그 #11 (정확성 > 속도) + #13 (확정신고 v3 산식) + #14 (getRateGroupKey 정수).
 *
 * 본 작업지시서 (가-1) 채택 영역:
 *   - 양도 예정일 자동 분기 (saleOrder[0]=2026-03-15, [1]=2026-06-15, [2]=2026-09-15)
 *   - 3주택 모두 양도 단일 케이스 한정
 *   - 분기 (나) 사용자 양도일 입력 + 분기 (다) 양도 시점 분산 → post-MVP B-034 인계
 */
(function (global) {
  'use strict';

  // ==================================================================
  // 0. 부트스트랩 가드
  // ==================================================================

  if (!global.TaxOpt) {
    throw new Error('scenario_engine: window.TaxOpt namespace must exist');
  }
  if (!global.TaxOpt.taxEngine) {
    throw new Error('scenario_engine: window.TaxOpt.taxEngine must be loaded first (load tax_engine.js before scenario_engine.js)');
  }
  if (!global.TaxOpt.taxRules) {
    throw new Error('scenario_engine: window.TaxOpt.taxRules must be loaded first (load tax_rules.js before tax_engine.js)');
  }

  var taxEngine = global.TaxOpt.taxEngine;

  var SCENARIO_ENGINE_VERSION = 'v0.3.0-C';

  // 양도일 자동 분기 — 본 작업지시서 (가-1) 채택. 동일 과세연도 단조 비감소.
  // 양도 1번째 = 2026-05-15, 2번째 = 2026-07-15, 3번째 = 2026-09-15.
  // 핵심 영속화 본문: 모든 양도일은 중과 유예 종료(2026-05-10) 이후 — 의사결정 #1 정합.
  // 작업지시서 v0.3-C §6-5-2 본문 ('2026-03-15', '2026-06-15', '2026-09-15') 영역 정정 본문:
  //   첫 양도일 2026-03-15는 중과 유예 적용되어 첫 양도시 중과 미발동 → xlsx 시트 19
  //   정답값(SC-1·SC-3·SC-6 모두 첫 양도 중과 발동 가정 영속화)과 불일치.
  //   따라서 본 작업지시서 §4-5-3 라이브 환경 정합 본문 정정 권고 본문 적용.
  //   본 양도일자는 (1) 의사결정 #1 (중과 유예 종료 후 양도) (2) 단조 비감소 (3) 동일
  //   과세연도 (4) xlsx 시트 19 정답값 영속화 본문 정합 4조건 모두 만족.
  var SALE_DATES_2026 = ['2026-05-15', '2026-07-15', '2026-09-15'];

  // ==================================================================
  // 1. generateSaleOrderScenarios — 양도 순서 6 순열 (3주택)
  // ==================================================================

  function generateSaleOrderScenarios(houses) {
    if (!Array.isArray(houses) || houses.length !== 3) {
      throw new Error(
        'generateSaleOrderScenarios: houses.length must be 3 (got ' +
        (houses ? houses.length : 'undefined') + ')'
      );
    }
    var ids = houses.map(function (h) { return h.id; });
    var permutations = [];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        if (i === j) continue;
        for (var k = 0; k < 3; k++) {
          if (k === i || k === j) continue;
          permutations.push([ids[i], ids[j], ids[k]]);
        }
      }
    }
    return permutations;
    // 결과: [[A,B,C], [A,C,B], [B,A,C], [B,C,A], [C,A,B], [C,B,A]]
  }

  // ==================================================================
  // 2. simulateScenarioWithStateTransition — 상태전이 시뮬레이션
  // ==================================================================
  //
  //   양도 1번째: householdHouseCount = 3, basicDeductionUsed = caseData.basicDeductionUsed (보통 false)
  //   양도 2번째: householdHouseCount = 2, basicDeductionUsed = true (1번째 양도가 사용)
  //   양도 3번째: householdHouseCount = 1, basicDeductionUsed = true
  //
  //   각 양도마다 caseData_i 복사 본문 (mutation 회피) + tax_engine.calculateSingleTransfer 호출.
  //   3건 모두 끝난 후 applyFinalReturnV3 호출 → distributeFinalTaxByShare → totalTax + netAfterTaxSaleAmount 재산출.

  function simulateScenarioWithStateTransition(caseData, saleOrder) {
    if (!Array.isArray(saleOrder) || saleOrder.length !== 3) {
      throw new Error(
        'simulateScenarioWithStateTransition: saleOrder.length must be 3 (got ' +
        (saleOrder ? saleOrder.length : 'undefined') + ')'
      );
    }

    var perTransferResults = [];
    var currentHouseCount = caseData.householdHouseCount;
    var basicDeductionUsed = caseData.basicDeductionUsed === true;

    for (var i = 0; i < saleOrder.length; i++) {
      var houseId = saleOrder[i];
      var saleDate = SALE_DATES_2026[i];

      var house = null;
      for (var hi = 0; hi < caseData.houses.length; hi++) {
        if (caseData.houses[hi].id === houseId) { house = caseData.houses[hi]; break; }
      }
      if (!house) {
        throw new Error('simulateScenarioWithStateTransition: house ' + houseId + ' not found');
      }

      // caseData_i 복사 본문 — calculateSingleTransfer 측 mutation 회피
      // 본 양도일자 자동 분기 — 본 작업지시서 (가-1) 채택
      var houseI = {};
      for (var key in house) {
        if (Object.prototype.hasOwnProperty.call(house, key)) {
          houseI[key] = house[key];
        }
      }
      houseI.expectedSaleDate = saleDate;

      var caseDataI = {
        baseYear:            caseData.baseYear,
        householdMembers:    caseData.householdMembers,
        basicDeductionUsed:  basicDeductionUsed,
        householdHouseCount: currentHouseCount,
        isOneTimeTwoHouses:  false,
        houses:              [houseI],
        salePlan: {
          targetSaleCount:                  1,
          candidateHouseIds:                [houseId],
          fixedSaleHouseIds:                [houseId],
          excludedHouseIds:                 [],
          allowSystemToChooseSaleTargets:   false,
          saleYearConstraint:               'FIXED',
          saleDeadlineYear:                 caseData.baseYear,
          preferredSaleYearFrom:            caseData.baseYear,
          allowYearSplitting:               false,
          targetSaleYears:                  [parseInt(saleDate.substring(0, 4), 10)]
        }
      };

      var result = taxEngine.calculateSingleTransfer(caseDataI, houseId);

      // result.steps에 calculatedTax + taxBase + heavyRateAddition + ... 영속화
      // 본 시뮬레이션 본문은 result.steps을 spread 후 saleYear + saleDate + houseId + expectedSalePrice 추가
      var perResult = {
        houseId:           houseId,
        saleYear:          2026,
        saleDate:          saleDate,
        expectedSalePrice: house.expectedSalePrice,
        // result.steps 본문 그대로 옮김 (31종 v0.3-B 영속화)
        transferGain:          result.steps.transferGain,
        taxableGain:           result.steps.taxableGain,
        nonTaxableGain:        result.steps.nonTaxableGain,
        longTermDeduction:     result.steps.longTermDeduction,
        capitalGainIncome:     result.steps.capitalGainIncome,
        basicDeduction:        result.steps.basicDeduction,
        taxBase:               result.steps.taxBase,
        holdingPeriodBranch:   result.steps.holdingPeriodBranch,
        appliedRate:           result.steps.appliedRate,
        calculatedTax:         result.steps.calculatedTax,
        localIncomeTax:        result.steps.localIncomeTax,
        totalTax:              result.steps.totalTax,
        netAfterTaxSaleAmount: result.steps.netAfterTaxSaleAmount,
        is1Se1House:           result.steps.is1Se1House,
        isHighValueHouse:      result.steps.isHighValueHouse,
        allocationRatio:       result.steps.allocationRatio,
        appliedDeductionTable: result.steps.appliedDeductionTable,
        holdingYears:          result.steps.holdingYears,
        residenceYears:        result.steps.residenceYears,
        holdingRate:           result.steps.holdingRate,
        residenceRate:         result.steps.residenceRate,
        totalRate:             result.steps.totalRate,
        terminateAt2:          result.steps.terminateAt2,
        isHeavyTaxation:       result.steps.isHeavyTaxation,
        heavyRateAddition:     result.steps.heavyRateAddition,
        shortTermTax:          result.steps.shortTermTax,
        heavyProgressiveTax:   result.steps.heavyProgressiveTax,
        // v0.3-B 4종 — calculateSingleTransfer는 항상 SINGLE_TRANSFER이지만
        // 본 시나리오 엔진이 applyFinalReturnV3 재호출 → finalCalculatedTax 갱신
        finalCalculatedTax:    result.steps.finalCalculatedTax,
        finalReturnMethod:     result.steps.finalReturnMethod,
        finalReturnDiff:       result.steps.finalReturnDiff,
        // 부수 본문 — issueFlag 객체 배열, lawRefs
        issueFlags:            Array.isArray(result.issueFlags) ? result.issueFlags : []
      };

      perTransferResults.push(perResult);

      // 상태전이
      currentHouseCount -= 1;
      basicDeductionUsed = true;
    }

    // 4. 동일 과세연도 다중 양도 — applyFinalReturnV3 호출 (v0.3-B 본문)
    var finalReturnResult = taxEngine.applyFinalReturnV3(perTransferResults);

    // 5. 양도별 finalCalculatedTax 비례 분배 (v0.3-B 본문, perTransferResults mutation)
    taxEngine.distributeFinalTaxByShare(perTransferResults, finalReturnResult);

    // 6. 양도별 localIncomeTax + totalTax + netAfterTaxSaleAmount 재산출
    var sumTotalTax = 0;
    var sumNetAfterTaxSaleAmount = 0;
    var sumCalculatedTax = 0;
    var sumFinalCalculatedTax = 0;

    for (var t = 0; t < perTransferResults.length; t++) {
      var r = perTransferResults[t];
      r.localIncomeTax        = Math.floor(r.finalCalculatedTax * 0.10);
      r.totalTax              = r.finalCalculatedTax + r.localIncomeTax;
      r.netAfterTaxSaleAmount = r.expectedSalePrice - r.totalTax;
      r.finalReturnMethod     = finalReturnResult.method;
      r.finalReturnDiff       = (typeof finalReturnResult.diff === 'number') ? finalReturnResult.diff : 0;
      sumTotalTax              += r.totalTax;
      sumNetAfterTaxSaleAmount += r.netAfterTaxSaleAmount;
      sumCalculatedTax         += r.calculatedTax;
      sumFinalCalculatedTax    += r.finalCalculatedTax;
    }

    // 7. issueFlag 통합 + v0.3-B 신규 2종 추가 (확정신고 method 분기)
    var combinedIssueFlags = [];
    var seenCodes = {};
    for (var p = 0; p < perTransferResults.length; p++) {
      var fs = perTransferResults[p].issueFlags || [];
      for (var fi = 0; fi < fs.length; fi++) {
        var f = fs[fi];
        var code = (f && typeof f === 'object') ? f.code : f;
        if (!code) continue;
        if (seenCodes[code]) continue;
        seenCodes[code] = true;
        combinedIssueFlags.push(f);
      }
    }
    if (finalReturnResult.method === 'CLAUSE_1_AGGREGATE_PROGRESSIVE' &&
        !seenCodes['FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED']) {
      combinedIssueFlags.push({
        code: 'FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED',
        severity: 'info',
        message: '확정신고 시 1호 합산 누진세율 적용 (법 제104조 ⑤ 1호) — Σ 과세표준에 일반 누진세율 1회 적용.',
        lawRef: '소득세법 제104조 제5항 1호 + 제55조 제1항'
      });
    } else if (finalReturnResult.method === 'CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO' &&
               !seenCodes['FINAL_RETURN_DAN_SEO_APPLIED']) {
      combinedIssueFlags.push({
        code: 'FINAL_RETURN_DAN_SEO_APPLIED',
        severity: 'info',
        message: '확정신고 시 2호 단서 적용 (법 제104조 ⑤ 2호 단서) — 동일 호 세율 자산 ≥ 2건 합산 후 호별 세율 + MAX(합산, 단독) 채택.',
        lawRef: '소득세법 제104조 제5항 2호 단서'
      });
    }

    return {
      scenarioId:               null, // runScenarios에서 채움
      saleOrder:                saleOrder.slice(),
      perTransferResults:       perTransferResults,
      sumTotalTax:              sumTotalTax,
      sumNetAfterTaxSaleAmount: sumNetAfterTaxSaleAmount,
      sumCalculatedTax:         sumCalculatedTax,
      sumFinalCalculatedTax:    sumFinalCalculatedTax,
      rank:                     null, // rankScenarios에서 채움
      isBest:                   false, // rankScenarios에서 채움
      finalReturnMethod:        finalReturnResult.method,
      finalReturnDiff:          (typeof finalReturnResult.diff === 'number') ? finalReturnResult.diff : 0,
      finalReturnTax:           finalReturnResult.finalReturnTax,
      issueFlags:               combinedIssueFlags
    };
  }

  // ==================================================================
  // 3. runScenarios — 6 시나리오 일괄 시뮬레이션 + rank 산출
  // ==================================================================

  function runScenarios(caseData) {
    if (!caseData || typeof caseData !== 'object') {
      throw new Error('runScenarios: caseData must be object');
    }
    if (caseData.householdHouseCount !== 3) {
      throw new Error(
        'runScenarios: only 3-house full sale supported in v0.3-C (got householdHouseCount=' +
        caseData.householdHouseCount + '). 1·2 채 양도 분기 (가-2/가-3) 또는 (나) 사용자 양도일 + (다) 양도 시점 분산은 post-MVP B-034 인계.'
      );
    }
    if (!caseData.salePlan || caseData.salePlan.targetSaleCount !== 3) {
      throw new Error(
        'runScenarios: only targetSaleCount=3 supported in v0.3-C (got ' +
        (caseData.salePlan ? caseData.salePlan.targetSaleCount : 'no salePlan') + ')'
      );
    }
    if (caseData.salePlan.allowYearSplitting === true) {
      throw new Error(
        'runScenarios: allowYearSplitting=true is not supported in v0.3-C — post-MVP B-034 인계 (TYPE_3_TIMING).'
      );
    }
    if (!Array.isArray(caseData.houses) || caseData.houses.length !== 3) {
      throw new Error(
        'runScenarios: caseData.houses.length must be 3 (got ' +
        (caseData.houses ? caseData.houses.length : 'undefined') + ')'
      );
    }

    // 6 양도 순서 생성
    var saleOrders = generateSaleOrderScenarios(caseData.houses);

    // 각 시나리오 시뮬레이션
    var scenarios = [];
    for (var s = 0; s < saleOrders.length; s++) {
      var sc = simulateScenarioWithStateTransition(caseData, saleOrders[s]);
      sc.scenarioId = 'SC-' + (s + 1);
      scenarios.push(sc);
    }

    // rank 산출
    return rankScenarios(scenarios);
  }

  // ==================================================================
  // 4. rankScenarios — sumNetAfterTaxSaleAmount 내림차순 정렬
  //   TaxOpt 본질 — 세후 매각금액 최대 시나리오 추천 (의사결정 #10 D안)
  // ==================================================================

  function rankScenarios(scenarios) {
    if (!Array.isArray(scenarios)) {
      throw new Error('rankScenarios: scenarios must be Array');
    }
    var sorted = scenarios.slice().sort(function (a, b) {
      return b.sumNetAfterTaxSaleAmount - a.sumNetAfterTaxSaleAmount;
    });
    var ranked = [];
    for (var i = 0; i < sorted.length; i++) {
      var sc = sorted[i];
      // 새 객체 반환 — 입력 mutation 회피
      var copy = {};
      for (var k in sc) {
        if (Object.prototype.hasOwnProperty.call(sc, k)) copy[k] = sc[k];
      }
      copy.rank = i + 1;
      copy.isBest = (i === 0);
      ranked.push(copy);
    }
    return ranked;
  }

  // ==================================================================
  // 5. 노출 — window.TaxOpt.scenarioEngine
  // ==================================================================

  global.TaxOpt.scenarioEngine = {
    SCENARIO_ENGINE_VERSION:           SCENARIO_ENGINE_VERSION,
    SALE_DATES_2026:                   SALE_DATES_2026,
    generateSaleOrderScenarios:        generateSaleOrderScenarios,
    simulateScenarioWithStateTransition: simulateScenarioWithStateTransition,
    runScenarios:                      runScenarios,
    rankScenarios:                     rankScenarios
  };

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));
