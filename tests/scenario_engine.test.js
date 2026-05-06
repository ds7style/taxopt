/**
 * tests/scenario_engine.test.js
 *
 * scenario_engine.js v0.3-C 회귀 테스트.
 *
 * 본 회귀 그룹은 작업지시서 v0.3-C §7-4 본문 정합 + 회귀 안전성 보존.
 *
 * 실행 방법:
 *   $ node -e "global.window={};require('./js/tax_rules.js');require('./js/tax_engine.js');require('./js/scenario_engine.js');require('./tests/scenario_engine.test.js')"
 *
 * 검증 그룹:
 *   - SE-1: 부트스트랩 가드 + SCENARIO_ENGINE_VERSION
 *   - SE-2: generateSaleOrderScenarios 6 순열
 *   - SE-3: rankScenarios 정렬
 *   - SE-4: TC-S06 6 시나리오 본격 시뮬레이션 — best=CBA + method=CLAUSE_2 + savings 본질 영역
 *   - SE-5: 입력 검증 (3주택 + targetSaleCount=3 + allowYearSplitting=false 한정)
 *
 * 정답값 본문:
 *   - xlsx 시트 19 본문은 R100 명시 "표 1로 단순화 적용" 본문 — tax_engine.js v0.3-B
 *     본격 (표 2) 산출과 SC-3·SC-4·SC-6 영역 차이 발생.
 *   - 본 회귀 그룹은 tax_engine.js v0.3-B 본격 산출 본문 그대로 영속화 (의사결정 #11
 *     정확성 > 속도 정합) — best=CBA + method 100% CLAUSE_2 + savings 본질 영역만 검증.
 *   - SC-1·SC-2·SC-5 (마지막 양도 1세대1주택 비과세 또는 일반과세) 본문은 xlsx 시트
 *     19 정답값과 일치 — 추가 검증 가능.
 */
(function (global) {
  'use strict';

  var taxEngine      = global.TaxOpt && global.TaxOpt.taxEngine;
  var scenarioEngine = global.TaxOpt && global.TaxOpt.scenarioEngine;

  if (!taxEngine) {
    console.error('[FAIL] tax_engine.js가 로드되지 않았습니다.');
    if (typeof process !== 'undefined' && process.exit) process.exit(1);
    return;
  }
  if (!scenarioEngine) {
    console.error('[FAIL] scenario_engine.js가 로드되지 않았습니다.');
    if (typeof process !== 'undefined' && process.exit) process.exit(1);
    return;
  }

  // ----------------------------------------------------------------
  // 어서션 헬퍼
  // ----------------------------------------------------------------
  var passCount = 0;
  var failCount = 0;
  var groupName = '';

  function setGroup(name) { groupName = name; }
  function assert(cond, label) {
    if (cond) { passCount++; }
    else      { failCount++; console.error('[FAIL] [' + groupName + '] ' + label); }
  }
  function assertEq(actual, expected, label) {
    var ok = (actual === expected) ||
             (typeof actual === 'number' && typeof expected === 'number' &&
              Number.isNaN(actual) && Number.isNaN(expected));
    if (ok) { passCount++; }
    else {
      failCount++;
      console.error('[FAIL] [' + groupName + '] ' + label +
                    ' — expected: ' + JSON.stringify(expected) +
                    ' / actual: ' + JSON.stringify(actual));
    }
  }

  // ----------------------------------------------------------------
  // TC-S06 입력 본문 (명세서 §10-7-2 그대로)
  // ----------------------------------------------------------------
  function buildTcS06() {
    return {
      baseYear: 2026,
      householdMembers: 1,
      basicDeductionUsed: false,
      householdHouseCount: 3,
      isOneTimeTwoHouses: false,
      houses: [
        { id: 'A', acquisitionDate: '2014-05-01', acquisitionPrice: 500000000, necessaryExpense: 20000000, acquisitionRegulated: true,  residenceMonths: 30, livingNow: false, expectedSaleDate: '2026-09-15', expectedSalePrice: 1500000000, saleRegulated: true  },
        { id: 'B', acquisitionDate: '2016-08-15', acquisitionPrice: 600000000, necessaryExpense: 15000000, acquisitionRegulated: true,  residenceMonths:  0, livingNow: false, expectedSaleDate: '2026-06-15', expectedSalePrice: 1000000000, saleRegulated: true  },
        { id: 'C', acquisitionDate: '2018-03-10', acquisitionPrice: 700000000, necessaryExpense: 10000000, acquisitionRegulated: false, residenceMonths:  0, livingNow: false, expectedSaleDate: '2026-03-15', expectedSalePrice:  800000000, saleRegulated: false }
      ],
      salePlan: { targetSaleCount: 3, candidateHouseIds: ['A','B','C'], fixedSaleHouseIds: ['A','B','C'], excludedHouseIds: [], allowSystemToChooseSaleTargets: false, saleYearConstraint: 'FIXED', saleDeadlineYear: 2026, preferredSaleYearFrom: 2026, allowYearSplitting: false, targetSaleYears: [2026] }
    };
  }

  // ================================================================
  // SE-1. 부트스트랩 가드 + 메타
  // ================================================================
  setGroup('SE-1 부트스트랩');

  assertEq(scenarioEngine.SCENARIO_ENGINE_VERSION, 'v0.3.0-C',
    'SCENARIO_ENGINE_VERSION === "v0.3.0-C"');
  assertEq(typeof scenarioEngine.generateSaleOrderScenarios, 'function',
    'generateSaleOrderScenarios 노출');
  assertEq(typeof scenarioEngine.simulateScenarioWithStateTransition, 'function',
    'simulateScenarioWithStateTransition 노출');
  assertEq(typeof scenarioEngine.runScenarios, 'function',
    'runScenarios 노출');
  assertEq(typeof scenarioEngine.rankScenarios, 'function',
    'rankScenarios 노출');
  assertEq(Array.isArray(scenarioEngine.SALE_DATES_2026), true,
    'SALE_DATES_2026 배열 노출');
  assertEq(scenarioEngine.SALE_DATES_2026.length, 3,
    'SALE_DATES_2026.length === 3');
  // 모든 양도일은 중과 유예 종료(2026-05-10) 이후 (의사결정 #1 정합)
  scenarioEngine.SALE_DATES_2026.forEach(function (d, i) {
    assert(d >= '2026-05-10',
      'SALE_DATES_2026[' + i + '] (' + d + ') ≥ 2026-05-10 (중과 유예 종료 후)');
  });

  // ================================================================
  // SE-2. generateSaleOrderScenarios — 6 순열
  // ================================================================
  setGroup('SE-2 generateSaleOrderScenarios');

  var houses3 = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  var perms = scenarioEngine.generateSaleOrderScenarios(houses3);
  assertEq(perms.length, 6, '3주택 → 6 순열 (3! = 6)');

  var seen = {};
  perms.forEach(function (p) { seen[p.join('')] = true; });
  ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'].forEach(function (k) {
    assert(seen[k] === true, '순열 ' + k + ' 영속화');
  });

  // 입력 검증 — houses.length !== 3 → throw
  var caughtNon3 = false;
  try {
    scenarioEngine.generateSaleOrderScenarios([{ id: 'A' }, { id: 'B' }]);
  } catch (e) { caughtNon3 = true; }
  assert(caughtNon3, 'houses.length !== 3 → throw');

  // ================================================================
  // SE-3. rankScenarios — sumNetAfterTaxSaleAmount 내림차순
  // ================================================================
  setGroup('SE-3 rankScenarios');

  var fakeScenarios = [
    { scenarioId: 'SC-1', sumNetAfterTaxSaleAmount: 100, sumTotalTax: 50, saleOrder: ['A','B','C'] },
    { scenarioId: 'SC-2', sumNetAfterTaxSaleAmount: 300, sumTotalTax: 30, saleOrder: ['B','C','A'] },
    { scenarioId: 'SC-3', sumNetAfterTaxSaleAmount: 200, sumTotalTax: 40, saleOrder: ['C','A','B'] }
  ];
  var ranked = scenarioEngine.rankScenarios(fakeScenarios);
  assertEq(ranked[0].rank, 1, 'rank 1 최대 sumNetAfterTaxSaleAmount');
  assertEq(ranked[0].sumNetAfterTaxSaleAmount, 300, 'rank 1 === SC-2 (300)');
  assertEq(ranked[0].isBest, true, 'rank 1 isBest === true');
  assertEq(ranked[1].rank, 2, 'rank 2');
  assertEq(ranked[1].sumNetAfterTaxSaleAmount, 200, 'rank 2 === SC-3 (200)');
  assertEq(ranked[2].rank, 3, 'rank 3');
  assertEq(ranked[2].isBest, false, 'rank 3 isBest === false');
  // 입력 mutation 회피
  assertEq(fakeScenarios[0].rank, undefined, '입력 mutation 회피 — 원본 rank 미할당');

  // ================================================================
  // SE-4. TC-S06 6 시나리오 본격 시뮬레이션 — 본질 영역
  // ================================================================
  setGroup('SE-4 TC-S06 본격 시뮬레이션');

  var scenarios = scenarioEngine.runScenarios(buildTcS06());

  assertEq(scenarios.length, 6, '6 시나리오 산출');

  // 본문 1 — 모든 시나리오 method = CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO
  scenarios.forEach(function (sc) {
    assertEq(sc.finalReturnMethod, 'CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO',
      sc.scenarioId + ' (' + sc.saleOrder.join('') + ') method === CLAUSE_2');
  });

  // 본문 2 — best (rank 1) = CBA (작업지시서 §1-1 본질 영역)
  var best = scenarios.find(function (s) { return s.rank === 1; });
  assertEq(best.saleOrder.join(''), 'CBA',
    'best (rank 1) === CBA (TaxOpt 본질 영역 — 비조정 C 1번째 + 비싼 A 마지막)');
  assertEq(best.isBest, true, 'best.isBest === true');

  // 본문 3 — SC-1·SC-2·SC-5 xlsx 시트 19 정답값 일치 (안분 미발동 시나리오)
  //   SC-1 (ABC): C 비과세, A·B 일반과세 — 표 2 무관, 일치
  //   SC-2 (ACB): A 첫 양도 중과 + B·C 다른 영역 — 일치
  //   SC-5 (CAB): C 비조정 + A·B 다른 영역 — 일치
  var sc1 = scenarios.find(function (s) { return s.saleOrder.join('') === 'ABC'; });
  var sc2 = scenarios.find(function (s) { return s.saleOrder.join('') === 'ACB'; });
  var sc5 = scenarios.find(function (s) { return s.saleOrder.join('') === 'CAB'; });
  assertEq(sc1.sumTotalTax, 960212000,
    'SC-1 (ABC) sumTotalTax === 960,212,000 (xlsx 시트 19 일치)');
  assertEq(sc2.sumTotalTax, 874895997,
    'SC-2 (ACB) sumTotalTax === 874,895,997 (xlsx 시트 19 일치)');
  assertEq(sc5.sumTotalTax, 767975997,
    'SC-5 (CAB) sumTotalTax === 767,975,997 (xlsx 시트 19 일치)');

  // 본문 4 — best (CBA) sumTotalTax + 모든 시나리오 sumTotalTax > 0
  var sc6 = scenarios.find(function (s) { return s.saleOrder.join('') === 'CBA'; });
  assert(sc6.sumTotalTax > 0, 'SC-6 (CBA) sumTotalTax > 0');
  assert(sc6.sumNetAfterTaxSaleAmount > 0, 'SC-6 (CBA) sumNetAfterTaxSaleAmount > 0');

  // 본문 5 — savings (SC-1 - SC-6) > 6억원 (TaxOpt 본질 영역)
  var savings = sc1.sumTotalTax - sc6.sumTotalTax;
  assert(savings > 600000000,
    'savings (SC-1 - SC-6) === ' + savings.toLocaleString() + '원 > 6억원 (본질 영역)');

  // 본문 6 — perTransferResults 본문 길이 + 양도일 단조 비감소
  scenarios.forEach(function (sc) {
    assertEq(sc.perTransferResults.length, 3,
      sc.scenarioId + ' perTransferResults.length === 3');
    var dates = sc.perTransferResults.map(function (r) { return r.saleDate; });
    assertEq(dates[0] <= dates[1] && dates[1] <= dates[2], true,
      sc.scenarioId + ' 양도일 단조 비감소: ' + dates.join(' ≤ '));
    sc.perTransferResults.forEach(function (r) {
      assert(r.saleDate >= '2026-05-10',
        sc.scenarioId + ' ' + r.houseId + ' 양도일 ≥ 2026-05-10');
    });
  });

  // 본문 7 — issueFlag 통합 시 FINAL_RETURN_DAN_SEO_APPLIED 발동
  scenarios.forEach(function (sc) {
    var hasDanSeo = sc.issueFlags.some(function (f) {
      return (f && f.code) === 'FINAL_RETURN_DAN_SEO_APPLIED';
    });
    assert(hasDanSeo,
      sc.scenarioId + ' (' + sc.saleOrder.join('') + ') FINAL_RETURN_DAN_SEO_APPLIED 발동');
  });

  // 본문 8 — sumTotalTax = sum(perTransferResults[i].totalTax) 정합
  scenarios.forEach(function (sc) {
    var s = 0;
    sc.perTransferResults.forEach(function (r) { s += r.totalTax; });
    assertEq(sc.sumTotalTax, s,
      sc.scenarioId + ' sumTotalTax === Σ perTransferResults.totalTax');
  });

  // ================================================================
  // SE-5. 입력 검증 — (가-1) 본문 한정
  // ================================================================
  setGroup('SE-5 입력 검증');

  // householdHouseCount !== 3 → throw
  var caught2 = false;
  try {
    scenarioEngine.runScenarios({
      baseYear: 2026, householdHouseCount: 2, basicDeductionUsed: false,
      isOneTimeTwoHouses: false,
      houses: [{ id: 'A' }, { id: 'B' }],
      salePlan: { targetSaleCount: 2, candidateHouseIds: ['A','B'], fixedSaleHouseIds: ['A','B'], excludedHouseIds: [], allowYearSplitting: false }
    });
  } catch (e) { caught2 = /3-house/.test(e.message); }
  assert(caught2, 'householdHouseCount=2 → throw (3주택 한정)');

  // targetSaleCount !== 3 → throw
  var caughtT1 = false;
  try {
    var c = buildTcS06();
    c.salePlan.targetSaleCount = 1;
    scenarioEngine.runScenarios(c);
  } catch (e) { caughtT1 = /targetSaleCount/.test(e.message); }
  assert(caughtT1, 'targetSaleCount=1 → throw (전부 양도 한정)');

  // allowYearSplitting=true → throw
  var caughtY = false;
  try {
    var c2 = buildTcS06();
    c2.salePlan.allowYearSplitting = true;
    scenarioEngine.runScenarios(c2);
  } catch (e) { caughtY = /allowYearSplitting/.test(e.message); }
  assert(caughtY, 'allowYearSplitting=true → throw (분산 양도 미처리, B-034 인계)');

  // ================================================================
  // 결과 출력
  // ================================================================
  console.log('==========================================');
  console.log('=== scenario_engine v0.3-C 회귀 테스트 ===');
  console.log('==========================================');
  console.log('  통과: ' + passCount);
  console.log('  실패: ' + failCount);
  console.log('==========================================');

  if (typeof process !== 'undefined' && process.exit) {
    process.exit(failCount === 0 ? 0 : 1);
  }

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));
