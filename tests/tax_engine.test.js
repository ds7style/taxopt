/**
 * tests/tax_engine.test.js
 *
 * tax_engine.js 회귀 테스트 (v0.1.1).
 *
 * 실행 방법:
 *   1) Node.js 단독:
 *      $ node -e "global.window={};require('./js/tax_rules.js');require('./js/tax_engine.js');require('./tests/tax_engine.test.js')"
 *
 *   2) 브라우저:
 *      <script src="../js/tax_rules.js"></script>
 *      <script src="../js/tax_engine.js"></script>
 *      <script src="./tax_engine.test.js"></script>
 *
 * 검증 범위:
 *   - 그룹 1: selfTest 부트스트랩 (3건)
 *   - 그룹 2: validateCaseData 입력 검증
 *   - 그룹 3: 13단계 파이프라인, TC-001~005 골든셋 (3자 일치 검증 완료)
 *   - 그룹 4: 단계별 함수 단위 테스트 (회귀 보호)
 *   - 그룹 5: issueFlag 발동 검증 (10종)
 *   - 그룹 6: 정수 산술 보장
 *   - 그룹 7: 순수성 + B-008 metrics
 *
 * 정답 출처: docs/v0.1/06_test_cases.md v0.1.1 (3자 일치 검증 완료)
 */
(function (global) {
  'use strict';

  var taxRules  = global.TaxOpt && global.TaxOpt.taxRules;
  var taxEngine = global.TaxOpt && global.TaxOpt.taxEngine;

  if (!taxRules) {
    console.error('[FAIL] tax_rules.js가 로드되지 않았습니다.');
    if (typeof process !== 'undefined' && process.exit) process.exit(1);
    return;
  }
  if (!taxEngine) {
    console.error('[FAIL] tax_engine.js가 로드되지 않았습니다.');
    if (typeof process !== 'undefined' && process.exit) process.exit(1);
    return;
  }

  // ----------------------------------------------------------------
  // 어서션 헬퍼 (tax_rules.test.js 패턴 동일)
  // ----------------------------------------------------------------

  var passed = 0;
  var failed = 0;
  var failures = [];
  var groupCounters = {};
  var currentGroup = '';

  function setGroup(name) {
    currentGroup = name;
    if (!groupCounters[name]) groupCounters[name] = { passed: 0, failed: 0 };
  }

  function _record(ok, label, detail) {
    if (ok) {
      passed++;
      if (currentGroup) groupCounters[currentGroup].passed++;
    } else {
      failed++;
      if (currentGroup) groupCounters[currentGroup].failed++;
      var line = '[' + currentGroup + '] ' + label + (detail ? ' ' + detail : '');
      failures.push(line);
      console.error('[FAIL] ' + line);
    }
  }

  function assert(cond, label) {
    _record(!!cond, label);
  }
  function assertEq(actual, expected, label) {
    _record(actual === expected, label,
            '(expected=' + expected + ', actual=' + actual + ')');
  }
  function assertNear(actual, expected, eps, label) {
    var ok = (typeof actual === 'number') && (typeof expected === 'number') &&
             Math.abs(actual - expected) <= eps;
    _record(ok, label, '(expected≈' + expected + ', actual=' + actual + ')');
  }
  function expectThrow(fn, label) {
    var threw = false;
    try { fn(); } catch (e) { threw = true; }
    _record(threw, label);
  }

  // ----------------------------------------------------------------
  // caseData 빌더 — TC 입력에서 caseData 전체를 조립
  // ----------------------------------------------------------------

  function buildCaseData(input, overrides) {
    var ov = overrides || {};
    return {
      caseId: ov.caseId || null,
      baseYear: (ov.baseYear !== undefined) ? ov.baseYear : 2026,
      householdMembers: 1,
      basicDeductionUsed: input.basicDeductionUsed === true,
      houses: [{
        id: 'A',
        nickname: ov.nickname || '주택 A',
        location: ov.location || '',
        acquisitionDate:      input.acquisitionDate,
        acquisitionPrice:     input.acquisitionPrice,
        necessaryExpense:     input.necessaryExpense,
        acquisitionRegulated: ov.acquisitionRegulated === true || input.acquisitionRegulated === true,
        residenceMonths:      (ov.residenceMonths !== undefined) ? ov.residenceMonths : 0,
        livingNow:            ov.livingNow === true,
        expectedSaleDate:     input.saleDate,
        expectedSalePrice:    input.salePrice,
        saleRegulated:        ov.saleRegulated === true || input.saleRegulated === true
      }],
      salePlan: {
        targetSaleCount: 1,
        candidateHouseIds: ['A'],
        fixedSaleHouseIds: ['A'],
        excludedHouseIds: [],
        allowSystemToChooseSaleTargets: false,
        allowYearSplitting: false,
        targetSaleYears: [(ov.baseYear !== undefined) ? ov.baseYear : 2026]
      }
    };
  }

  // ----------------------------------------------------------------
  // 골든셋 — docs/v0.1/06_test_cases.md v0.1.1 (3자 일치 검증 완료)
  // ----------------------------------------------------------------

  var TC_GOLDEN_V01 = [
    {
      id: 'TC-001',
      intent: '정상 일반과세 (보유 6년 7개월, 누진 5구간 38%)',
      input: {
        acquisitionDate:    '2020-01-15',
        acquisitionPrice:   500000000,
        necessaryExpense:    10000000,
        saleDate:           '2026-08-31',
        salePrice:          800000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      expected: {
        transferGain:          290000000,
        taxableGain:           290000000,
        longTermDeduction:             0,
        capitalGainIncome:     290000000,
        basicDeduction:          2500000,
        taxBase:               287500000,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    5,
        calculatedTax:          89310000,
        localIncomeTax:          8931000,
        totalTax:               98241000,
        netAfterTaxSaleAmount: 701759000
      }
    },
    {
      id: 'TC-002',
      intent: '단기세율 60% (보유 1년 7개월)',
      input: {
        acquisitionDate:    '2025-01-15',
        acquisitionPrice:   600000000,
        necessaryExpense:     5000000,
        saleDate:           '2026-08-31',
        salePrice:          700000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      expected: {
        transferGain:           95000000,
        taxableGain:            95000000,
        longTermDeduction:             0,
        capitalGainIncome:      95000000,
        basicDeduction:          2500000,
        taxBase:                92500000,
        holdingPeriodBranch:  'under2y',
        appliedRateType:      'short60',
        appliedRateBracket:   null,
        calculatedTax:          55500000,
        localIncomeTax:          5550000,
        totalTax:               61050000,
        netAfterTaxSaleAmount: 638950000
      }
    },
    {
      id: 'TC-003',
      intent: '양도차손 (양도가액 < 취득가액)',
      input: {
        acquisitionDate:    '2020-06-01',
        acquisitionPrice:   500000000,
        necessaryExpense:    10000000,
        saleDate:           '2026-09-30',
        salePrice:          480000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      expected: {
        transferGain:          -30000000,
        taxableGain:           -30000000,
        longTermDeduction:             0,
        capitalGainIncome:     -30000000,
        basicDeduction:          2500000,
        taxBase:                       0,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    1,
        calculatedTax:                 0,
        localIncomeTax:                0,
        totalTax:                      0,
        netAfterTaxSaleAmount: 480000000
      }
    },
    {
      id: 'TC-004',
      intent: '기본공제 이미 사용 (TC-001 변형)',
      input: {
        acquisitionDate:    '2020-01-15',
        acquisitionPrice:   500000000,
        necessaryExpense:    10000000,
        saleDate:           '2026-08-31',
        salePrice:          800000000,
        basicDeductionUsed: true,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      expected: {
        transferGain:          290000000,
        taxableGain:           290000000,
        longTermDeduction:             0,
        capitalGainIncome:     290000000,
        basicDeduction:                0,
        taxBase:               290000000,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    5,
        calculatedTax:          90260000,
        localIncomeTax:          9026000,
        totalTax:               99286000,
        netAfterTaxSaleAmount: 700714000
      }
    },
    {
      id: 'TC-005',
      intent: '누진 1구간 경계값 (taxBase=14,000,000)',
      input: {
        acquisitionDate:    '2018-03-01',
        acquisitionPrice:   200000000,
        necessaryExpense:           0,
        saleDate:           '2026-07-15',
        salePrice:          216500000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      expected: {
        transferGain:           16500000,
        taxableGain:            16500000,
        longTermDeduction:             0,
        capitalGainIncome:      16500000,
        basicDeduction:          2500000,
        taxBase:                14000000,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    1,
        calculatedTax:            840000,
        localIncomeTax:            84000,
        totalTax:                 924000,
        netAfterTaxSaleAmount: 215576000
      }
    }
  ];

  // ================================================================
  // 그룹 1 — selfTest 부트스트랩 검증
  // ================================================================
  setGroup('그룹1 selfTest');

  var st = taxEngine.selfTest();
  assert(st.ok === true, 'tax_engine.selfTest() ok=true');
  assert(st.taxRulesSelfTest && st.taxRulesSelfTest.ok === true,
         'selfTest 결과에 tax_rules selfTest ok=true 포함');
  assert(st.sanityChecks && Array.isArray(st.sanityChecks.checks) &&
         st.sanityChecks.checks.length === 3,
         'selfTest sanityChecks 3건 (TC-001/003/005)');
  if (st.sanityChecks && st.sanityChecks.checks) {
    var ids = st.sanityChecks.checks.map(function (c) { return c.id; });
    assert(ids.indexOf('TC-001') >= 0, 'sanityChecks에 TC-001 포함');
    assert(ids.indexOf('TC-003') >= 0, 'sanityChecks에 TC-003 포함');
    assert(ids.indexOf('TC-005') >= 0, 'sanityChecks에 TC-005 포함');
  }
  assertEq(taxEngine.ENGINE_VERSION, 'v0.1.1-post-20260510', 'ENGINE_VERSION');

  // ================================================================
  // 그룹 2 — validateCaseData
  // ================================================================
  setGroup('그룹2 validateCaseData');

  // 정상 입력
  var v_ok = taxEngine.validateCaseData(buildCaseData(TC_GOLDEN_V01[0].input));
  assertEq(v_ok.ok, true,                'validateCaseData 정상 입력 → ok=true');
  assertEq(v_ok.errors.length, 0,        '정상 입력 errors 0개');

  // salePrice=0
  var v_sp0 = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 0, basicDeductionUsed: false
  }));
  assertEq(v_sp0.ok, false,              'salePrice=0 → ok=false');
  assert(v_sp0.errors.length >= 1,       'salePrice=0 errors ≥ 1');

  // salePrice=-1
  var v_spneg = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: -1, basicDeductionUsed: false
  }));
  assertEq(v_spneg.ok, false,            'salePrice=-1 → ok=false');

  // salePrice=1.5 (비정수)
  var v_spfrac = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 1.5, basicDeductionUsed: false
  }));
  assertEq(v_spfrac.ok, false,           'salePrice=1.5 → ok=false (비정수)');

  // acquisitionPrice=0
  var v_ap0 = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 0, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 800000000, basicDeductionUsed: false
  }));
  assertEq(v_ap0.ok, false,              'acquisitionPrice=0 → ok=false');

  // necessaryExpense=-1
  var v_neneg = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: -1,
    saleDate: '2026-08-31', salePrice: 800000000, basicDeductionUsed: false
  }));
  assertEq(v_neneg.ok, false,            'necessaryExpense=-1 → ok=false');

  // acquisitionDate >= saleDate
  var v_dateOrder = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2026-08-31', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2020-01-15', salePrice: 800000000, basicDeductionUsed: false
  }));
  assertEq(v_dateOrder.ok, false,        'acquisitionDate >= saleDate → ok=false');

  // saleDate < "2026-05-10" → 경고
  var v_dateEarly = taxEngine.validateCaseData(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2026-05-09', salePrice: 800000000, basicDeductionUsed: false
  }));
  assertEq(v_dateEarly.ok, true,         'saleDate=2026-05-09 → ok=true (경고만)');
  assert(v_dateEarly.warnings.length >= 1,
                                          'saleDate=2026-05-09 → warnings ≥ 1');

  // acquisitionRegulated=true → 경고
  var v_reg = taxEngine.validateCaseData(buildCaseData(
    TC_GOLDEN_V01[0].input, { acquisitionRegulated: true }
  ));
  assertEq(v_reg.ok, true,               'acquisitionRegulated=true → ok=true (경고만)');
  assert(v_reg.warnings.length >= 1,     'acquisitionRegulated=true → warnings ≥ 1');

  // ================================================================
  // 그룹 3 — 13단계 파이프라인 (TC-001~005 골든셋, 핵심)
  // ================================================================
  setGroup('그룹3 골든셋');

  TC_GOLDEN_V01.forEach(function (tc) {
    var caseData = buildCaseData(tc.input);
    var result;
    try {
      result = taxEngine.calculateSingleTransfer(caseData);
    } catch (e) {
      _record(false, tc.id + ' calculateSingleTransfer 실행', '(error: ' + e.message + ')');
      return;
    }

    var s = result.steps;
    var e = tc.expected;

    assertEq(s.transferGain,        e.transferGain,        tc.id + ' transferGain');
    assertEq(s.taxableGain,         e.taxableGain,         tc.id + ' taxableGain');
    assertEq(s.longTermDeduction,   e.longTermDeduction,   tc.id + ' longTermDeduction');
    assertEq(s.capitalGainIncome,   e.capitalGainIncome,   tc.id + ' capitalGainIncome');
    assertEq(s.basicDeduction,      e.basicDeduction,      tc.id + ' basicDeduction');
    assertEq(s.taxBase,             e.taxBase,             tc.id + ' taxBase');
    assertEq(s.holdingPeriodBranch, e.holdingPeriodBranch, tc.id + ' holdingPeriodBranch');
    assertEq(s.appliedRate.type,    e.appliedRateType,     tc.id + ' appliedRate.type');
    assertEq(s.appliedRate.bracket, e.appliedRateBracket,  tc.id + ' appliedRate.bracket');
    assertEq(s.calculatedTax,       e.calculatedTax,       tc.id + ' calculatedTax');
    assertEq(s.localIncomeTax,      e.localIncomeTax,      tc.id + ' localIncomeTax');
    assertEq(s.totalTax,            e.totalTax,            tc.id + ' totalTax');
    assertEq(s.netAfterTaxSaleAmount,
                                    e.netAfterTaxSaleAmount,
                                                           tc.id + ' netAfterTaxSaleAmount');

    // metrics 미러링
    assertEq(result.metrics.totalTax,              e.totalTax,
             tc.id + ' metrics.totalTax === steps.totalTax');
    assertEq(result.metrics.netAfterTaxSaleAmount, e.netAfterTaxSaleAmount,
             tc.id + ' metrics.netAfterTaxSaleAmount === steps.netAfterTaxSaleAmount');

    // metrics.effectiveTaxRate
    var expectedRate = e.totalTax / tc.input.salePrice;
    assertNear(result.metrics.effectiveTaxRate, expectedRate, 1e-9,
               tc.id + ' metrics.effectiveTaxRate ≈ totalTax/salePrice');

    // 메타
    // NOTE: tax_rules.js v0.2 패치로 RULE_VERSION 갱신 (작업지시서 03 §3-1 + A-5-2).
    //       engineVersion은 tax_engine.js v0.1.1 그대로 (v0.2 패치는 작업지시서 04에서).
    assertEq(result.ruleVersion,   'v0.2.0-post-20260510', tc.id + ' ruleVersion');
    assertEq(result.engineVersion, 'v0.1.1-post-20260510', tc.id + ' engineVersion');
  });

  // ================================================================
  // 그룹 4 — 단계별 함수 단위 테스트
  // ================================================================
  setGroup('그룹4 단계별');

  // 1단계 computeTransferGain
  assertEq(taxEngine.computeTransferGain({
    salePrice: 800000000, acquisitionPrice: 500000000, necessaryExpense: 10000000
  }), 290000000, '1단계: 800M − 500M − 10M = 290M');
  assertEq(taxEngine.computeTransferGain({
    salePrice: 480000000, acquisitionPrice: 500000000, necessaryExpense: 10000000
  }), -30000000, '1단계: 480M − 500M − 10M = -30M (음수 가능)');

  // 2~4단계 passthrough
  assertEq(taxEngine.applyNonTaxation(290000000, {}),             290000000, '2단계: passthrough');
  assertEq(taxEngine.applyHighValueAllocation(290000000, {}),     290000000, '3단계: passthrough');
  assertEq(taxEngine.computeLongTermDeduction(290000000, {}),             0, '4단계: 무조건 0');

  // 5단계
  assertEq(taxEngine.computeCapitalGainIncome(290000000, 0),      290000000, '5단계: 290M − 0');

  // 6단계 computeBasicDeduction
  assertEq(taxEngine.computeBasicDeduction(false), 2500000, '6단계: 미사용 → 2,500,000');
  assertEq(taxEngine.computeBasicDeduction(true),        0, '6단계: 사용 → 0');

  // 7단계 computeTaxBase
  assertEq(taxEngine.computeTaxBase(290000000, 2500000), 287500000, '7단계: 양수 차감');
  assertEq(taxEngine.computeTaxBase(-30000000, 2500000),         0, '7단계: 음수 → 0 (TC-003 회귀)');

  // 8단계 determineHoldingPeriodBranch — 동월동일 경계
  assertEq(taxEngine.determineHoldingPeriodBranch('2025-01-15', '2026-01-15'),
           'under2y', '8단계: 정확히 1년 → under2y (under1y 아님)');
  assertEq(taxEngine.determineHoldingPeriodBranch('2025-01-15', '2026-01-14'),
           'under1y', '8단계: 1년-1일 → under1y');
  assertEq(taxEngine.determineHoldingPeriodBranch('2024-01-15', '2026-01-15'),
           'over2y',  '8단계: 정확히 2년 → over2y (under2y 아님)');
  assertEq(taxEngine.determineHoldingPeriodBranch('2024-01-15', '2026-01-14'),
           'under2y', '8단계: 2년-1일 → under2y');
  assertEq(taxEngine.determineHoldingPeriodBranch('2018-03-01', '2026-07-15'),
           'over2y',  '8단계: TC-005 (8년 4개월) → over2y');
  assertEq(taxEngine.determineHoldingPeriodBranch('2025-01-15', '2026-08-31'),
           'under2y', '8단계: TC-002 (1년 7개월) → under2y');

  // 9단계 determineAppliedRate
  var ar1 = taxEngine.determineAppliedRate('under1y', 50000000);
  assertEq(ar1.type,    'short70', '9단계: under1y → type=short70');
  assertEq(ar1.bracket, null,      '9단계: under1y → bracket=null');
  var ar2 = taxEngine.determineAppliedRate('under2y', 92500000);
  assertEq(ar2.type,    'short60', '9단계: under2y → type=short60');
  var ar3 = taxEngine.determineAppliedRate('over2y', 14000000);
  assertEq(ar3.type,    'basic',   '9단계: over2y, taxBase=14M → type=basic');
  assertEq(ar3.bracket, 1,         '9단계: over2y, taxBase=14M → bracket=1');
  var ar4 = taxEngine.determineAppliedRate('over2y', 287500000);
  assertEq(ar4.bracket, 5,         '9단계: over2y, taxBase=287.5M → bracket=5');

  // 10단계 computeCalculatedTax
  assertEq(taxEngine.computeCalculatedTax(92500000, ar2),
           55500000, '10단계: 92.5M × 0.6 = 55.5M (TC-002)');
  assertEq(taxEngine.computeCalculatedTax(287500000, ar4),
           89310000, '10단계: TC-001 누진 5구간 = 89,310,000');
  assertEq(taxEngine.computeCalculatedTax(14000000, ar3),
           840000,   '10단계: TC-005 누진 1구간 = 840,000');

  // 11단계 computeLocalIncomeTax (Math.floor 보호)
  assertEq(taxEngine.computeLocalIncomeTax(89310000),
           8931000, '11단계: floor(89,310,000 × 0.1) = 8,931,000');
  assertEq(taxEngine.computeLocalIncomeTax(0),
                 0, '11단계: floor(0 × 0.1) = 0 (TC-003)');
  assertEq(taxEngine.computeLocalIncomeTax(840000),
            84000, '11단계: floor(840,000 × 0.1) = 84,000');

  // 12단계
  assertEq(taxEngine.computeTotalTax(89310000, 8931000),
           98241000, '12단계: 89,310,000 + 8,931,000 = 98,241,000');

  // 13단계
  assertEq(taxEngine.computeNetAfterTaxSaleAmount(800000000, 98241000),
           701759000, '13단계: 800M − 98,241,000 = 701,759,000');

  // 14단계 (B-008)
  assertNear(taxEngine.computeEffectiveTaxRate(98241000, 800000000),
             0.12280125, 1e-9, '14단계: TC-001 effectiveTaxRate ≈ 0.1228');
  assertEq(taxEngine.computeEffectiveTaxRate(0, 0), null,
           '14단계: salePrice=0 → null');
  assertEq(taxEngine.computeEffectiveTaxRate(0, 480000000), 0,
           '14단계: TC-003 totalTax=0 → 0');

  // ================================================================
  // 그룹 5 — issueFlag 발동 검증 (10종)
  // ================================================================
  setGroup('그룹5 issueFlag');

  function findFlag(result, code) {
    for (var i = 0; i < result.issueFlags.length; i++) {
      if (result.issueFlags[i].code === code) return result.issueFlags[i];
    }
    return null;
  }
  function hasFlag(result, code) { return findFlag(result, code) !== null; }

  var r001 = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  var r002 = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[1].input));
  var r003 = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[2].input));

  // (1) LONG_TERM_DEDUCTION_NOT_APPLIED
  assert( hasFlag(r001, 'LONG_TERM_DEDUCTION_NOT_APPLIED'),
          'TC-001 LONG_TERM_DEDUCTION_NOT_APPLIED 발동 (보유 6.7년)');
  assert(!hasFlag(r002, 'LONG_TERM_DEDUCTION_NOT_APPLIED'),
          'TC-002 LONG_TERM_DEDUCTION_NOT_APPLIED 미발동 (보유 1.7년)');

  // (10) TRANSFER_LOSS_DETECTED
  assert( hasFlag(r003, 'TRANSFER_LOSS_DETECTED'),
          'TC-003 TRANSFER_LOSS_DETECTED 발동');
  assert(!hasFlag(r001, 'TRANSFER_LOSS_DETECTED'),
          'TC-001 TRANSFER_LOSS_DETECTED 미발동');

  // (4) OUT_OF_V01_SCOPE_REGULATED_AREA
  var rRegulated = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V01[0].input, { saleRegulated: true })
  );
  assert(hasFlag(rRegulated, 'OUT_OF_V01_SCOPE_REGULATED_AREA'),
         'saleRegulated=true → OUT_OF_V01_SCOPE_REGULATED_AREA 발동');
  assert(!hasFlag(r001, 'OUT_OF_V01_SCOPE_REGULATED_AREA'),
         '비조정대상 → OUT_OF_V01_SCOPE_REGULATED_AREA 미발동');

  // (3) HIGH_VALUE_HOUSE — 12억 경계
  var rHigh = taxEngine.calculateSingleTransfer(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 800000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 1200000000, basicDeductionUsed: false
  }));
  assert(hasFlag(rHigh, 'HIGH_VALUE_HOUSE'),
         'salePrice=1,200,000,000 → HIGH_VALUE_HOUSE 발동');
  var rHighMinus = taxEngine.calculateSingleTransfer(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 800000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 1199999999, basicDeductionUsed: false
  }));
  assert(!hasFlag(rHighMinus, 'HIGH_VALUE_HOUSE'),
         'salePrice=1,199,999,999 → HIGH_VALUE_HOUSE 미발동');

  // (2) POSSIBLE_NON_TAXATION_1H1H — 보유 ≥ 2년 + 거주 ≥ 24개월 + candidateHouseCount=1
  var rNT = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V01[0].input, { residenceMonths: 36 })
  );
  assert(hasFlag(rNT, 'POSSIBLE_NON_TAXATION_1H1H'),
         '보유 ≥ 2년 + 거주 ≥ 24개월 + 단일 후보 → POSSIBLE_NON_TAXATION_1H1H 발동');
  assert(!hasFlag(r001, 'POSSIBLE_NON_TAXATION_1H1H'),
         'TC-001 (residenceMonths=0) → POSSIBLE_NON_TAXATION_1H1H 미발동');

  // (5) OUT_OF_V01_SCOPE_DATE
  var rEarlyDate = taxEngine.calculateSingleTransfer(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2026-05-09', salePrice: 800000000, basicDeductionUsed: false
  }));
  assert(hasFlag(rEarlyDate, 'OUT_OF_V01_SCOPE_DATE'),
         'saleDate=2026-05-09 → OUT_OF_V01_SCOPE_DATE 발동');
  assert(!hasFlag(r001, 'OUT_OF_V01_SCOPE_DATE'),
         'saleDate=2026-08-31 → OUT_OF_V01_SCOPE_DATE 미발동');

  // (6) NECESSARY_EXPENSE_BREAKDOWN_MISSING — 항상
  assert(hasFlag(r001, 'NECESSARY_EXPENSE_BREAKDOWN_MISSING'),
         'NECESSARY_EXPENSE_BREAKDOWN_MISSING 항상 발동 (TC-001)');
  assert(hasFlag(r002, 'NECESSARY_EXPENSE_BREAKDOWN_MISSING'),
         'NECESSARY_EXPENSE_BREAKDOWN_MISSING 항상 발동 (TC-002)');

  // (7) UNREGISTERED_ASSET_ASSUMED_FALSE — 항상
  assert(hasFlag(r001, 'UNREGISTERED_ASSET_ASSUMED_FALSE'),
         'UNREGISTERED_ASSET_ASSUMED_FALSE 항상 발동');

  // (8) ACQUISITION_CAUSE_ASSUMED_PURCHASE — 항상
  assert(hasFlag(r001, 'ACQUISITION_CAUSE_ASSUMED_PURCHASE'),
         'ACQUISITION_CAUSE_ASSUMED_PURCHASE 항상 발동');

  // (9) HOLDING_PERIOD_BOUNDARY — 1년 경계 ±3일
  var rBoundary = taxEngine.calculateSingleTransfer(buildCaseData({
    acquisitionDate: '2025-05-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
    saleDate: '2026-05-16', salePrice: 800000000, basicDeductionUsed: false
  }));
  assert(hasFlag(rBoundary, 'HOLDING_PERIOD_BOUNDARY'),
         '보유 1년 경계 +1일 → HOLDING_PERIOD_BOUNDARY 발동');
  assert(!hasFlag(r001, 'HOLDING_PERIOD_BOUNDARY'),
         'TC-001 (경계 무관) → HOLDING_PERIOD_BOUNDARY 미발동');

  // ================================================================
  // 그룹 6 — 정수 산술 보장
  // ================================================================
  setGroup('그룹6 정수성');

  var amountFields = ['transferGain', 'taxableGain', 'longTermDeduction',
                      'capitalGainIncome', 'basicDeduction', 'taxBase',
                      'calculatedTax', 'localIncomeTax', 'totalTax',
                      'netAfterTaxSaleAmount'];

  TC_GOLDEN_V01.forEach(function (tc) {
    var r = taxEngine.calculateSingleTransfer(buildCaseData(tc.input));
    amountFields.forEach(function (f) {
      assert(Number.isInteger(r.steps[f]),
             tc.id + ' steps.' + f + ' is integer (' + r.steps[f] + ')');
    });
    assert(Number.isInteger(r.metrics.totalTax),
           tc.id + ' metrics.totalTax is integer');
    assert(Number.isInteger(r.metrics.netAfterTaxSaleAmount),
           tc.id + ' metrics.netAfterTaxSaleAmount is integer');
    assert(Number.isInteger(r.steps.appliedRate.baseTax),
           tc.id + ' appliedRate.baseTax is integer');
  });

  // ================================================================
  // 그룹 7 — 순수성 + B-008 metrics
  // ================================================================
  setGroup('그룹7 순수성');

  var caseDataPure = buildCaseData(TC_GOLDEN_V01[0].input);
  var snapshotBefore = JSON.stringify(caseDataPure);
  var rPure1 = taxEngine.calculateSingleTransfer(caseDataPure);
  var snapshotAfter = JSON.stringify(caseDataPure);
  assertEq(snapshotAfter, snapshotBefore,
           'calculateSingleTransfer는 caseData를 변경하지 않는다 (deep equal)');

  // 동일 입력 → 동일 출력 (steps 완전 일치)
  var rPure2 = taxEngine.calculateSingleTransfer(caseDataPure);
  assertEq(JSON.stringify(rPure1.steps), JSON.stringify(rPure2.steps),
           '동일 입력 → 동일 steps');
  assertEq(JSON.stringify(rPure1.metrics), JSON.stringify(rPure2.metrics),
           '동일 입력 → 동일 metrics');

  // metrics 미러링 (TC-001)
  assertEq(rPure1.metrics.totalTax, rPure1.steps.totalTax,
           'metrics.totalTax === steps.totalTax (TC-001)');
  assertEq(rPure1.metrics.netAfterTaxSaleAmount, rPure1.steps.netAfterTaxSaleAmount,
           'metrics.netAfterTaxSaleAmount === steps.netAfterTaxSaleAmount (TC-001)');
  assertNear(rPure1.metrics.effectiveTaxRate,
             rPure1.steps.totalTax / rPure1.inputsEcho.salePrice,
             1e-12,
             'metrics.effectiveTaxRate === totalTax / salePrice (TC-001)');

  // TC-003 양도차손 → effectiveTaxRate=0
  var rLoss = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[2].input));
  assertEq(rLoss.metrics.effectiveTaxRate, 0,
           'metrics.effectiveTaxRate === 0 (TC-003 양도차손)');

  // 부트스트랩 가드: tax_rules 제거 시 calculateSingleTransfer throw
  var savedRules = global.TaxOpt.taxRules;
  global.TaxOpt.taxRules = null;
  expectThrow(function () {
    taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  }, 'tax_rules 미로드 시 calculateSingleTransfer throw');
  global.TaxOpt.taxRules = savedRules;

  // ================================================================
  // 결과 출력
  // ================================================================

  console.log('==========================================');
  console.log('=== tax_engine v0.1.1 회귀 테스트 ===');
  console.log('==========================================');
  Object.keys(groupCounters).forEach(function (g) {
    var c = groupCounters[g];
    var total = c.passed + c.failed;
    console.log('  ' + g + ': ' + c.passed + '/' + total +
                (c.failed > 0 ? ' (실패 ' + c.failed + ')' : ''));
  });
  console.log('------------------------------------------');
  console.log('  통과: ' + passed);
  console.log('  실패: ' + failed);
  if (failed > 0) {
    console.log('  실패 항목:');
    for (var j = 0; j < failures.length; j++) {
      console.log('    - ' + failures[j]);
    }
  }
  console.log('==========================================');
  console.log('총 ' + passed + '건 통과 / ' + failed + '건 실패');
  console.log('==========================================');

  if (typeof global.TaxOpt !== 'undefined') {
    global.TaxOpt._taxEngineTestResult = {
      passed: passed, failed: failed,
      groupCounters: groupCounters, failures: failures
    };
  }
  if (failed > 0 && typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));
