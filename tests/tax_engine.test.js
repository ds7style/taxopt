/**
 * tests/tax_engine.test.js
 *
 * tax_engine.js 회귀 테스트 (v0.2.0).
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
 *   ── v0.1 회귀 (234건, 작업지시서 §2-3 단서 적용) ──
 *   - 그룹 1: selfTest 부트스트랩 (v0.1)
 *   - 그룹 2: validateCaseData 입력 검증 (v0.1)
 *   - 그룹 3: 13단계 파이프라인, TC-001~005 골든셋 (3자 일치 검증 완료)
 *   - 그룹 4: 단계별 함수 단위 테스트 (회귀 보호)
 *   - 그룹 5: issueFlag 발동 검증 (v0.1 10종 — 폐기 1·이름 변경 1 갱신 적용)
 *   - 그룹 6: 정수 산술 보장
 *   - 그룹 7: 순수성 + B-008 metrics
 *   ── v0.2 신규 회귀 ──
 *   - 그룹 8: selfTest 보강 (TC-006/008/010 sanity + 부트스트랩 가드)
 *   - 그룹 9: validateCaseData v0.2 (자동 보정 + 신규 검증)
 *   - 그룹 10: 13단계 파이프라인, TC-006~010 골든셋 (3자 일치 검증 완료, KPI 100%)
 *   - 그룹 11: TC-001~005 입력 패치 회귀 (v0.1 결과값 보존)
 *   - 그룹 12: 단계 2·3·4 단위 함수 (check1Se1HouseExemption / calculateHighValuePortion / calculateLongTermDeduction)
 *   - 그룹 13: issueFlag 카탈로그 18종 + terminateAt2 후속 단계 0/null 정책
 *
 * 정답 출처:
 *   - v0.1 회귀: docs/v0.1/06_test_cases.md v0.1.1 (3자 일치)
 *   - v0.2 회귀: docs/v0.2/06_test_cases.md v0.2.1 (3자 일치, KPI 100%)
 *
 * v0.1 → v0.2 패치 노트 (작업지시서 §2-3 단서 적용):
 *   - (a) RULE_VERSION strict-eq 1라인 (5/1 commit 8612cad에서 이미 갱신)
 *   - (b) v0.2 신규 회귀 그룹 8~13 추가 (자유)
 *   - (c) ENGINE_VERSION strict-eq 라인 갱신 ("v0.1.1" → "v0.2.0")
 *   - 추가: buildCaseData에 householdHouseCount: 2 기본값 추가 (v0.1 회귀의
 *     자동 보정으로 인한 비과세 분기 진입 회피, 다주택 처리 보장)
 *   - 추가: LONG_TERM_DEDUCTION_NOT_APPLIED 폐기에 따라 발동 검증 라인 갱신 (미발동)
 *   - 추가: UNREGISTERED_ASSET_ASSUMED_FALSE → UNREGISTERED_RATE_NOT_APPLIED (이름 변경)
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
  // 어서션 헬퍼
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
  //
  // v0.2 패치: householdHouseCount: 2 기본값 추가.
  //  - v0.1 회귀(TC-001~005)는 다주택으로 처리되어 자동 보정으로 인한 비과세
  //    분기 진입 위험을 회피한다 (작업지시서 §11-2-7 v0.1 회귀 보호).
  //  - v0.2 케이스(TC-006~010)는 overrides로 1을 명시.
  // ----------------------------------------------------------------

  function buildCaseData(input, overrides) {
    var ov = overrides || {};
    return {
      caseId: ov.caseId || null,
      baseYear: (ov.baseYear !== undefined) ? ov.baseYear : 2026,
      householdMembers: 1,
      householdHouseCount: (ov.householdHouseCount !== undefined) ? ov.householdHouseCount : 2,
      isOneTimeTwoHouses: ov.isOneTimeTwoHouses === true,
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

  function findFlag(result, code) {
    for (var i = 0; i < result.issueFlags.length; i++) {
      if (result.issueFlags[i].code === code) return result.issueFlags[i];
    }
    return null;
  }
  function hasFlag(result, code) { return findFlag(result, code) !== null; }

  // ================================================================
  // 골든셋 — TC-001~005 (v0.1) + TC-006~010 (v0.2)
  // ================================================================

  var TC_GOLDEN_V01 = [
    {
      id: 'TC-001',
      intent: '정상 일반과세 (보유 6년 7개월, v0.2 표 1 12% 적용 후 누진 5구간 38%)',
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
      // v0.2 단계 4 활성화 후 정답 (다주택 + 보유 6년 → 표 1 12%):
      //   longTermDeduction = floor(290M × 0.12) = 34,800,000
      //   capitalGainIncome = 290M - 34.8M = 255,200,000
      //   taxBase = 255.2M - 2.5M = 252,700,000 (5구간 1.5억~3억, 38%)
      //   calculatedTax = floor(37,060,000 + (252.7M-150M) × 0.38) = 76,086,000
      //   localIncomeTax = floor(76,086,000 × 0.1) = 7,608,600
      //   totalTax = 83,694,600
      expected: {
        transferGain:          290000000,
        taxableGain:           290000000,
        longTermDeduction:      34800000,
        capitalGainIncome:     255200000,
        basicDeduction:          2500000,
        taxBase:               252700000,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    5,
        calculatedTax:          76086000,
        localIncomeTax:          7608600,
        totalTax:               83694600,
        netAfterTaxSaleAmount: 716305400
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
      intent: '기본공제 이미 사용 (TC-001 변형, v0.2 표 1 12% 적용)',
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
      // v0.2: longTermDeduction 34.8M, taxBase 255.2M (basicDeduction=0이므로 = capitalGainIncome)
      //   calculatedTax = floor(37,060,000 + (255.2M-150M) × 0.38) = 77,036,000
      //   totalTax = 84,739,600
      expected: {
        transferGain:          290000000,
        taxableGain:           290000000,
        longTermDeduction:      34800000,
        capitalGainIncome:     255200000,
        basicDeduction:                0,
        taxBase:               255200000,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    5,
        calculatedTax:          77036000,
        localIncomeTax:          7703600,
        totalTax:               84739600,
        netAfterTaxSaleAmount: 715260400
      }
    },
    {
      id: 'TC-005',
      intent: '보유 8년 (v0.2 표 1 16% 적용 후 누진 1구간)',
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
      // v0.2: 다주택 + 보유 8년(표 1 16%):
      //   longTermDeduction = floor(16.5M × 0.16) = 2,640,000
      //   capitalGainIncome = 16.5M - 2.64M = 13,860,000
      //   taxBase = 13.86M - 2.5M = 11,360,000 (1구간 6%)
      //   calculatedTax = floor(11.36M × 0.06) = 681,600
      //   totalTax = 749,760
      expected: {
        transferGain:           16500000,
        taxableGain:            16500000,
        longTermDeduction:       2640000,
        capitalGainIncome:      13860000,
        basicDeduction:          2500000,
        taxBase:                11360000,
        holdingPeriodBranch:  'over2y',
        appliedRateType:      'basic',
        appliedRateBracket:    1,
        calculatedTax:            681600,
        localIncomeTax:            68160,
        totalTax:                 749760,
        netAfterTaxSaleAmount: 215750240
      }
    }
  ];

  // v0.2 골든셋 — docs/v0.2/06_test_cases.md v0.2.1 (검증 완료, KPI 100%)
  // overrides: householdHouseCount, isOneTimeTwoHouses 등 v0.2 신규 필드
  var TC_GOLDEN_V02 = [
    {
      id: 'TC-006',
      intent: '1세대1주택 비과세 + 12억 이하 (전액 비과세)',
      input: {
        acquisitionDate:    '2021-04-30',
        acquisitionPrice:   600000000,
        necessaryExpense:    15000000,
        saleDate:           '2026-08-31',
        salePrice:         1000000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      overrides: { householdHouseCount: 1, residenceMonths: 60, livingNow: true },
      expected: {
        transferGain:          385000000,
        taxableGain:                   0,    // terminateAt2
        nonTaxableGain:        385000000,
        is1Se1House:                true,
        isHighValueHouse:           false,
        terminateAt2:               true,
        allocationRatio:             1.0,
        appliedDeductionTable:      null,
        holdingYears:                  5,
        residenceYears:                5,
        holdingRate:                   0,
        residenceRate:                 0,
        totalRate:                     0,
        longTermDeduction:             0,
        capitalGainIncome:             0,
        basicDeduction:                0,
        taxBase:                       0,
        holdingPeriodBranch:  'over2y',
        appliedRate:                null,
        calculatedTax:                 0,
        localIncomeTax:                0,
        totalTax:                      0,
        netAfterTaxSaleAmount: 1000000000,
        effectiveTaxRate:              0
      }
    },
    {
      id: 'TC-007',
      intent: '1세대1주택 + 12억 초과 (안분 + 표 2 64%)',
      input: {
        acquisitionDate:    '2018-06-15',
        acquisitionPrice:   800000000,
        necessaryExpense:    30000000,
        saleDate:           '2026-09-30',
        salePrice:         1500000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      overrides: { householdHouseCount: 1, residenceMonths: 96 },
      expected: {
        transferGain:          670000000,
        taxableGain:           134000000,
        nonTaxableGain:                0,
        is1Se1House:                true,
        isHighValueHouse:           true,
        terminateAt2:              false,
        allocationRatio:             0.2,
        appliedDeductionTable:         2,
        holdingYears:                  8,
        residenceYears:                8,
        holdingRate:                0.32,
        residenceRate:              0.32,
        totalRate:                  0.64,
        longTermDeduction:      85760000,
        capitalGainIncome:      48240000,
        basicDeduction:          2500000,
        taxBase:                45740000,
        holdingPeriodBranch:  'over2y',
        appliedRateBracket:            2,
        calculatedTax:           5601000,
        localIncomeTax:           560100,
        totalTax:                6161100,
        netAfterTaxSaleAmount: 1493838900
      }
    },
    {
      id: 'TC-008',
      intent: '다주택 일반과세 + 표 1 (보유 12년 → 24%)',
      input: {
        acquisitionDate:    '2014-05-20',
        acquisitionPrice:   500000000,
        necessaryExpense:    20000000,
        saleDate:           '2026-08-15',
        salePrice:         1000000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      overrides: { householdHouseCount: 2, residenceMonths: 0 },
      expected: {
        transferGain:          480000000,
        taxableGain:           480000000,
        nonTaxableGain:                0,
        is1Se1House:               false,
        isHighValueHouse:          false,
        terminateAt2:              false,
        allocationRatio:             1.0,
        appliedDeductionTable:         1,
        holdingYears:                 12,
        residenceYears:                0,
        holdingRate:                0.24,
        residenceRate:                 0,
        totalRate:                  0.24,
        longTermDeduction:     115200000,
        capitalGainIncome:     364800000,
        basicDeduction:          2500000,
        taxBase:               362300000,
        holdingPeriodBranch:  'over2y',
        appliedRateBracket:            6,
        calculatedTax:         118980000,
        localIncomeTax:         11898000,
        totalTax:              130878000,
        netAfterTaxSaleAmount: 869122000
      }
    },
    {
      id: 'TC-009',
      intent: '1세대1주택 + 표 2 최대 80% (안분 + 0% 과세표준)',
      input: {
        acquisitionDate:    '2016-04-30',
        acquisitionPrice:   700000000,
        necessaryExpense:    25000000,
        saleDate:           '2026-09-15',
        salePrice:         1400000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      overrides: { householdHouseCount: 1, residenceMonths: 120 },
      expected: {
        transferGain:          675000000,
        taxableGain:            96428571,    // Math.floor(675000000 × 1/7)
        nonTaxableGain:                0,
        is1Se1House:                true,
        isHighValueHouse:           true,
        terminateAt2:              false,
        appliedDeductionTable:         2,
        holdingYears:                 10,
        residenceYears:               10,
        holdingRate:                0.40,
        residenceRate:              0.40,
        totalRate:                  0.80,
        longTermDeduction:      77142856,
        capitalGainIncome:      19285715,
        basicDeduction:          2500000,
        taxBase:                16785715,
        holdingPeriodBranch:  'over2y',
        appliedRateBracket:            2,
        calculatedTax:           1257857,
        localIncomeTax:           125785,
        totalTax:                1383642,
        netAfterTaxSaleAmount: 1398616358
      }
    },
    {
      id: 'TC-010',
      intent: '일시적 2주택 (적용 안 함, 다주택 일반과세 + 표 1 10%)',
      input: {
        acquisitionDate:    '2021-05-20',
        acquisitionPrice:   600000000,
        necessaryExpense:    15000000,
        saleDate:           '2026-08-31',
        salePrice:         1000000000,
        basicDeductionUsed: false,
        acquisitionRegulated: false,
        saleRegulated:        false
      },
      overrides: { householdHouseCount: 2, isOneTimeTwoHouses: true, residenceMonths: 0 },
      expected: {
        transferGain:          385000000,
        taxableGain:           385000000,
        nonTaxableGain:                0,
        is1Se1House:               false,
        isHighValueHouse:          false,
        terminateAt2:              false,
        allocationRatio:             1.0,
        appliedDeductionTable:         1,
        holdingYears:                  5,
        residenceYears:                0,
        holdingRate:                0.10,
        residenceRate:                 0,
        totalRate:                  0.10,
        longTermDeduction:      38500000,
        capitalGainIncome:     346500000,
        basicDeduction:          2500000,
        taxBase:               344000000,
        holdingPeriodBranch:  'over2y',
        appliedRateBracket:            6,
        calculatedTax:         111660000,
        localIncomeTax:         11166000,
        totalTax:              122826000,
        netAfterTaxSaleAmount: 877174000
      }
    }
  ];

  // ================================================================
  // 그룹 1 — selfTest 부트스트랩 검증 (v0.1 회귀)
  // ================================================================
  setGroup('그룹1 selfTest');

  var st = taxEngine.selfTest();
  assert(st.ok === true, 'tax_engine.selfTest() ok=true');
  assert(st.taxRulesSelfTest && st.taxRulesSelfTest.ok === true,
         'selfTest 결과에 tax_rules selfTest ok=true 포함');
  // v0.3-A: sanityChecks 8건 (v0.2 6건 + TC-011·012, 작업지시서 06 §10-3-1)
  assert(st.sanityChecks && Array.isArray(st.sanityChecks.checks) &&
         st.sanityChecks.checks.length === 8,
         'selfTest sanityChecks 8건 (v0.2 6건 + TC-011·012)');
  if (st.sanityChecks && st.sanityChecks.checks) {
    var ids = st.sanityChecks.checks.map(function (c) { return c.id; });
    assert(ids.indexOf('TC-001') >= 0, 'sanityChecks에 TC-001 포함');
    assert(ids.indexOf('TC-003') >= 0, 'sanityChecks에 TC-003 포함');
    assert(ids.indexOf('TC-005') >= 0, 'sanityChecks에 TC-005 포함');
  }
  // v0.3-A: ENGINE_VERSION 갱신 (작업지시서 06 §4-7 + §10-1 (a) strict-eq 1라인 갱신)
  assertEq(taxEngine.ENGINE_VERSION, 'v0.3.0-A', 'ENGINE_VERSION');

  // ================================================================
  // 그룹 2 — validateCaseData (v0.1 회귀)
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

  // saleRegulated=true → 경고 (v0.2: acquisitionRegulated는 거주요건 정상 활용 → 경고 아님)
  var v_reg = taxEngine.validateCaseData(buildCaseData(
    TC_GOLDEN_V01[0].input, { saleRegulated: true }
  ));
  assertEq(v_reg.ok, true,               'saleRegulated=true → ok=true (경고만)');
  assert(v_reg.warnings.length >= 1,     'saleRegulated=true → warnings ≥ 1');

  // ================================================================
  // 그룹 3 — 13단계 파이프라인 (TC-001~005 골든셋, v0.1 회귀 핵심)
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

    // 메타 (작업지시서 §2-3 단서 (a)·(c) 적용 — 호출 측 모듈 v0.2 갱신 반영)
    // v0.3-A 갱신 (작업지시서 06 §10-1 (a) strict-eq 라인 갱신 — golden 테스트가 매번 이 라인을 호출)
    assertEq(result.ruleVersion,   'v0.3.0-post-20260510', tc.id + ' ruleVersion');
    assertEq(result.engineVersion, 'v0.3.0-A',             tc.id + ' engineVersion');
  });

  // ================================================================
  // 그룹 4 — 단계별 함수 단위 테스트 (v0.1 회귀)
  // ================================================================
  setGroup('그룹4 단계별');

  // 1단계 computeTransferGain
  assertEq(taxEngine.computeTransferGain({
    salePrice: 800000000, acquisitionPrice: 500000000, necessaryExpense: 10000000
  }), 290000000, '1단계: 800M − 500M − 10M = 290M');
  assertEq(taxEngine.computeTransferGain({
    salePrice: 480000000, acquisitionPrice: 500000000, necessaryExpense: 10000000
  }), -30000000, '1단계: 480M − 500M − 10M = -30M (음수 가능)');

  // 2~4단계 — v0.1 호환 passthrough/0 (caseData 부족 시)
  assertEq(taxEngine.applyNonTaxation(290000000, {}),             290000000, '2단계: passthrough (caseData 부족)');
  assertEq(taxEngine.applyHighValueAllocation(290000000, {}),     290000000, '3단계: passthrough (caseData 부족)');
  assertEq(taxEngine.computeLongTermDeduction(290000000, {}),             0, '4단계: 무조건 0 (v0.1 호환 stub)');

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
  var ar3 = taxEngine.determineAppliedRate('over2y', 11360000);
  assertEq(ar3.type,    'basic',   '9단계: over2y, taxBase=11.36M → type=basic (TC-005 v0.2)');
  assertEq(ar3.bracket, 1,         '9단계: over2y, taxBase=11.36M → bracket=1');
  var ar4 = taxEngine.determineAppliedRate('over2y', 252700000);
  assertEq(ar4.bracket, 5,         '9단계: over2y, taxBase=252.7M → bracket=5 (TC-001 v0.2)');

  // 10단계 computeCalculatedTax (v0.2 단계 4 활성 후 정답)
  assertEq(taxEngine.computeCalculatedTax(92500000, ar2),
           55500000, '10단계: 92.5M × 0.6 = 55.5M (TC-002)');
  assertEq(taxEngine.computeCalculatedTax(252700000, ar4),
           76086000, '10단계: TC-001 v0.2 누진 5구간 = 76,086,000');
  assertEq(taxEngine.computeCalculatedTax(11360000, ar3),
           681600,   '10단계: TC-005 v0.2 누진 1구간 = 681,600');

  // 11단계 computeLocalIncomeTax (Math.floor 보호)
  assertEq(taxEngine.computeLocalIncomeTax(76086000),
           7608600, '11단계: floor(76,086,000 × 0.1) = 7,608,600 (TC-001 v0.2)');
  assertEq(taxEngine.computeLocalIncomeTax(0),
                 0, '11단계: floor(0 × 0.1) = 0 (TC-003)');
  assertEq(taxEngine.computeLocalIncomeTax(681600),
            68160, '11단계: floor(681,600 × 0.1) = 68,160 (TC-005 v0.2)');

  // 12단계
  assertEq(taxEngine.computeTotalTax(76086000, 7608600),
           83694600, '12단계: 76,086,000 + 7,608,600 = 83,694,600 (TC-001 v0.2)');

  // 13단계
  assertEq(taxEngine.computeNetAfterTaxSaleAmount(800000000, 83694600),
           716305400, '13단계: 800M − 83,694,600 = 716,305,400 (TC-001 v0.2)');

  // 14단계 (B-008)
  assertNear(taxEngine.computeEffectiveTaxRate(83694600, 800000000),
             0.10461825, 1e-9, '14단계: TC-001 v0.2 effectiveTaxRate ≈ 0.1046');
  assertEq(taxEngine.computeEffectiveTaxRate(0, 0), null,
           '14단계: salePrice=0 → null');
  assertEq(taxEngine.computeEffectiveTaxRate(0, 480000000), 0,
           '14단계: TC-003 totalTax=0 → 0');

  // ================================================================
  // 그룹 5 — issueFlag 발동 검증 (v0.1 10종, 폐기·이름 변경 갱신 반영)
  // ================================================================
  setGroup('그룹5 issueFlag');

  var r001 = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  var r002 = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[1].input));
  var r003 = taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[2].input));

  // (1) LONG_TERM_DEDUCTION_NOT_APPLIED — v0.2 폐기 (작업지시서 §5-2)
  assert(!hasFlag(r001, 'LONG_TERM_DEDUCTION_NOT_APPLIED'),
          'TC-001 LONG_TERM_DEDUCTION_NOT_APPLIED 미발동 (v0.2 폐기)');
  assert(!hasFlag(r002, 'LONG_TERM_DEDUCTION_NOT_APPLIED'),
          'TC-002 LONG_TERM_DEDUCTION_NOT_APPLIED 미발동 (v0.2 폐기)');

  // (10) TRANSFER_LOSS_DETECTED
  assert( hasFlag(r003, 'TRANSFER_LOSS_DETECTED'),
          'TC-003 TRANSFER_LOSS_DETECTED 발동');
  assert(!hasFlag(r001, 'TRANSFER_LOSS_DETECTED'),
          'TC-001 TRANSFER_LOSS_DETECTED 미발동');

  // (4) OUT_OF_V01_SCOPE_REGULATED_AREA — v0.3-A 폐기 (작업지시서 06 §4-6-4 + §12-2 N-19)
  //   v0.3-A에서 saleRegulated 활성 입력 전환으로 "v0.1 범위 외" 의미 소멸.
  //   대체: SALE_REGULATED_USER_INPUT (info, 항상 발동).
  var rRegulated = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V01[0].input, { saleRegulated: true })
  );
  assert(!hasFlag(rRegulated, 'OUT_OF_V01_SCOPE_REGULATED_AREA'),
         'saleRegulated=true → OUT_OF_V01_SCOPE_REGULATED_AREA 미발동 (v0.3-A 폐기)');
  assert(!hasFlag(r001, 'OUT_OF_V01_SCOPE_REGULATED_AREA'),
         '비조정대상 → OUT_OF_V01_SCOPE_REGULATED_AREA 미발동 (v0.3-A 폐기)');

  // (3) HIGH_VALUE_HOUSE — 12억 경계 (v0.2 변경: !is1Se1House 조건 추가)
  var rHigh = taxEngine.calculateSingleTransfer(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 800000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 1200000000, basicDeductionUsed: false
  }));
  assert(hasFlag(rHigh, 'HIGH_VALUE_HOUSE'),
         'salePrice=1,200,000,000 + 다주택 → HIGH_VALUE_HOUSE 발동');
  var rHighMinus = taxEngine.calculateSingleTransfer(buildCaseData({
    acquisitionDate: '2020-01-15', acquisitionPrice: 800000000, necessaryExpense: 10000000,
    saleDate: '2026-08-31', salePrice: 1199999999, basicDeductionUsed: false
  }));
  assert(!hasFlag(rHighMinus, 'HIGH_VALUE_HOUSE'),
         'salePrice=1,199,999,999 → HIGH_VALUE_HOUSE 미발동');

  // (2) POSSIBLE_NON_TAXATION_1H1H — v0.2 발동조건 변경 (다주택 + 잠재 가능 케이스만)
  // v0.1 회귀 의도: 조건 만족 시 발동 검증. v0.2에서는 1세대1주택 시 IS_1SE_1HOUSE로 대체.
  // 본 케이스는 다주택(householdHouseCount=2)인데 candidateHouseCount=1 + 거주 ≥ 24M이지만
  // is1Se1House=false (다주택)이고 householdHouseCount !== 1이므로 v0.2 발동조건 불충족 → 미발동.
  var rNT_v02 = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V01[0].input, { residenceMonths: 36, householdHouseCount: 1 })
  );
  // 1세대1주택 + 보유≥2년 + 거주≥24M + acquisitionRegulated=false → 비과세 적용 → IS_1SE_1HOUSE
  assert(hasFlag(rNT_v02, 'IS_1SE_1HOUSE'),
         '1세대1주택 비과세 적용 케이스 → IS_1SE_1HOUSE 발동');
  assert(!hasFlag(rNT_v02, 'POSSIBLE_NON_TAXATION_1H1H'),
         '비과세 적용 시 POSSIBLE_NON_TAXATION_1H1H 미발동 (v0.2 중복 회피)');
  assert(!hasFlag(r001, 'POSSIBLE_NON_TAXATION_1H1H'),
         'TC-001 (다주택) → POSSIBLE_NON_TAXATION_1H1H 미발동');

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

  // (7) UNREGISTERED_RATE_NOT_APPLIED — 항상 (v0.1 UNREGISTERED_ASSET_ASSUMED_FALSE 이름 변경)
  assert(hasFlag(r001, 'UNREGISTERED_RATE_NOT_APPLIED'),
         'UNREGISTERED_RATE_NOT_APPLIED 항상 발동 (v0.2 이름 변경)');
  assert(!hasFlag(r001, 'UNREGISTERED_ASSET_ASSUMED_FALSE'),
         'UNREGISTERED_ASSET_ASSUMED_FALSE 미발동 (v0.2 이름 변경 후 폐기)');

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
  // 그룹 6 — 정수 산술 보장 (v0.1 회귀)
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
  // 그룹 7 — 순수성 + B-008 metrics (v0.1 회귀)
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
  // 그룹 8 — selfTest 보강 검증 (v0.2 신규, 작업지시서 §10-2-1)
  // ================================================================
  setGroup('그룹8 selfTest v0.2');

  // sanityChecks: TC-006/008/010 결과 검증
  if (st.sanityChecks && st.sanityChecks.checks) {
    var ids2 = st.sanityChecks.checks.map(function (c) { return c.id; });
    assert(ids2.indexOf('TC-006') >= 0, 'sanityChecks에 TC-006 포함 (v0.2 보강)');
    assert(ids2.indexOf('TC-008') >= 0, 'sanityChecks에 TC-008 포함 (v0.2 보강)');
    assert(ids2.indexOf('TC-010') >= 0, 'sanityChecks에 TC-010 포함 (v0.2 보강)');
    st.sanityChecks.checks.forEach(function (c) {
      assert(c.ok === true, 'selfTest sanity ' + c.id + ' ok=true');
    });
  }
  assertEq(st.sanityChecks.ok, true, 'sanityChecks.ok === true (전체)');

  // 부트스트랩 가드 — tax_rules.HIGH_VALUE_HOUSE_THRESHOLD 미로드 시 throw
  var savedThreshold = global.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD;
  delete global.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD;
  expectThrow(function () {
    taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  }, '부트스트랩 가드 — HIGH_VALUE_HOUSE_THRESHOLD 미로드 시 throw');
  global.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD = savedThreshold;

  // 부트스트랩 가드 — findHoldingRate 미로드 시 throw
  var savedFindHolding = global.TaxOpt.taxRules.findHoldingRate;
  global.TaxOpt.taxRules.findHoldingRate = null;
  expectThrow(function () {
    taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  }, '부트스트랩 가드 — findHoldingRate 미로드 시 throw');
  global.TaxOpt.taxRules.findHoldingRate = savedFindHolding;

  // 부트스트랩 가드 — findResidenceRate 미로드 시 throw
  var savedFindResidence = global.TaxOpt.taxRules.findResidenceRate;
  global.TaxOpt.taxRules.findResidenceRate = null;
  expectThrow(function () {
    taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  }, '부트스트랩 가드 — findResidenceRate 미로드 시 throw');
  global.TaxOpt.taxRules.findResidenceRate = savedFindResidence;

  // 부트스트랩 가드 — LONG_TERM_DEDUCTION_TABLE_1 미로드 시 throw
  var savedTable1 = global.TaxOpt.taxRules.LONG_TERM_DEDUCTION_TABLE_1;
  global.TaxOpt.taxRules.LONG_TERM_DEDUCTION_TABLE_1 = null;
  expectThrow(function () {
    taxEngine.calculateSingleTransfer(buildCaseData(TC_GOLDEN_V01[0].input));
  }, '부트스트랩 가드 — LONG_TERM_DEDUCTION_TABLE_1 미로드 시 throw');
  global.TaxOpt.taxRules.LONG_TERM_DEDUCTION_TABLE_1 = savedTable1;

  // ================================================================
  // 그룹 9 — validateCaseData v0.2 (자동 보정 + 신규 검증)
  // ================================================================
  setGroup('그룹9 validateCaseData v0.2');

  // 자동 보정 — householdHouseCount 누락 → candidateHouseIds.length로 보정
  var cd_noHHC = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cd_noHHC.householdHouseCount;  // 명시 제거
  var v_hhc = taxEngine.validateCaseData(cd_noHHC);
  assertEq(v_hhc.ok, true, 'householdHouseCount 누락 → ok=true (자동 보정)');
  assertEq(v_hhc.correctedCaseData.householdHouseCount, 1,
           '자동 보정: candidateHouseIds.length(=1)로 보정');
  assert(v_hhc.autoCorrections.indexOf('HOUSEHOLD_COUNT_INFERRED') >= 0,
         'autoCorrections에 HOUSEHOLD_COUNT_INFERRED 포함');

  // householdHouseCount === 0 → 에러
  var cd_hhc0 = buildCaseData(TC_GOLDEN_V01[0].input, { householdHouseCount: 0 });
  var v_hhc0 = taxEngine.validateCaseData(cd_hhc0);
  assertEq(v_hhc0.ok, false, 'householdHouseCount=0 → ok=false');
  assert(v_hhc0.errors.length >= 1, 'householdHouseCount=0 errors ≥ 1');

  // householdHouseCount = -1 → 에러
  var cd_hhcNeg = buildCaseData(TC_GOLDEN_V01[0].input, { householdHouseCount: -1 });
  var v_hhcNeg = taxEngine.validateCaseData(cd_hhcNeg);
  assertEq(v_hhcNeg.ok, false, 'householdHouseCount=-1 → ok=false');

  // 자동 보정 — residenceMonths 누락 → 0 보정
  var cd_noRM = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cd_noRM.houses[0].residenceMonths;
  var v_rm = taxEngine.validateCaseData(cd_noRM);
  assertEq(v_rm.ok, true, 'residenceMonths 누락 → ok=true (자동 보정)');
  assertEq(v_rm.correctedCaseData.houses[0].residenceMonths, 0,
           '자동 보정: residenceMonths=0');
  assert(v_rm.autoCorrections.indexOf('RESIDENCE_MONTHS_DEFAULTED_ZERO') >= 0,
         'autoCorrections에 RESIDENCE_MONTHS_DEFAULTED_ZERO 포함');

  // residenceMonths < 0 → 에러
  var cd_rmNeg = buildCaseData(TC_GOLDEN_V01[0].input, { residenceMonths: -1 });
  var v_rmNeg = taxEngine.validateCaseData(cd_rmNeg);
  assertEq(v_rmNeg.ok, false, 'residenceMonths=-1 → ok=false');

  // 자동 보정 — livingNow 누락 → false 보정
  var cd_noLN = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cd_noLN.houses[0].livingNow;
  var v_ln = taxEngine.validateCaseData(cd_noLN);
  assertEq(v_ln.ok, true, 'livingNow 누락 → ok=true (자동 보정)');
  assertEq(v_ln.correctedCaseData.houses[0].livingNow, false, '자동 보정: livingNow=false');

  // 자동 보정 — isOneTimeTwoHouses 누락 → false 보정
  var cd_noOT = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cd_noOT.isOneTimeTwoHouses;
  var v_ot = taxEngine.validateCaseData(cd_noOT);
  assertEq(v_ot.ok, true, 'isOneTimeTwoHouses 누락 → ok=true (자동 보정)');
  assertEq(v_ot.correctedCaseData.isOneTimeTwoHouses, false, '자동 보정: isOneTimeTwoHouses=false');

  // 자동 보정 — acquisitionRegulated 누락 → false 보정 (v0.1 호환)
  var cd_noAR = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cd_noAR.houses[0].acquisitionRegulated;
  var v_ar = taxEngine.validateCaseData(cd_noAR);
  assertEq(v_ar.ok, true, 'acquisitionRegulated 누락 → ok=true (자동 보정)');
  assertEq(v_ar.correctedCaseData.houses[0].acquisitionRegulated, false,
           '자동 보정: acquisitionRegulated=false');

  // 자동 보정 — specialTaxFlags 누락 → 객체 보정
  var cd_noSTF = buildCaseData(TC_GOLDEN_V01[0].input);
  var v_stf = taxEngine.validateCaseData(cd_noSTF);
  assert(v_stf.correctedCaseData.specialTaxFlags &&
         typeof v_stf.correctedCaseData.specialTaxFlags === 'object',
         '자동 보정: specialTaxFlags 객체로 보정');

  // 자동 보정 — specialTaxRequirementsMet 누락 → [] 보정
  assert(Array.isArray(v_stf.correctedCaseData.specialTaxRequirementsMet),
         '자동 보정: specialTaxRequirementsMet [] 보정');

  // 입력 객체 변경 없음 (deep equal)
  var cd_immut = buildCaseData(TC_GOLDEN_V01[0].input);
  var snapImmut = JSON.stringify(cd_immut);
  taxEngine.validateCaseData(cd_immut);
  assertEq(JSON.stringify(cd_immut), snapImmut,
           'validateCaseData는 caseData를 변경하지 않는다 (deep equal)');

  // ================================================================
  // 그룹 10 — 13단계 파이프라인 (TC-006~010 v0.2 골든셋)
  // ================================================================
  setGroup('그룹10 v0.2 골든셋');

  TC_GOLDEN_V02.forEach(function (tc) {
    var caseData = buildCaseData(tc.input, tc.overrides);
    var result;
    try {
      result = taxEngine.calculateSingleTransfer(caseData);
    } catch (e) {
      _record(false, tc.id + ' calculateSingleTransfer 실행', '(error: ' + e.message + ')');
      return;
    }

    var s = result.steps;
    var e = tc.expected;

    // 핵심 검증 — totalTax (3자 일치 KPI 100%)
    assertEq(s.totalTax, e.totalTax, tc.id + ' totalTax (KPI 100%)');
    assertEq(s.netAfterTaxSaleAmount, e.netAfterTaxSaleAmount, tc.id + ' netAfterTaxSaleAmount');

    // v0.1 13단계 산출값
    assertEq(s.transferGain, e.transferGain, tc.id + ' transferGain');
    assertEq(s.taxableGain, e.taxableGain, tc.id + ' taxableGain');
    assertEq(s.nonTaxableGain, e.nonTaxableGain, tc.id + ' nonTaxableGain');
    assertEq(s.longTermDeduction, e.longTermDeduction, tc.id + ' longTermDeduction');
    assertEq(s.capitalGainIncome, e.capitalGainIncome, tc.id + ' capitalGainIncome');
    assertEq(s.basicDeduction, e.basicDeduction, tc.id + ' basicDeduction');
    assertEq(s.taxBase, e.taxBase, tc.id + ' taxBase');
    assertEq(s.holdingPeriodBranch, e.holdingPeriodBranch, tc.id + ' holdingPeriodBranch');
    assertEq(s.calculatedTax, e.calculatedTax, tc.id + ' calculatedTax');
    assertEq(s.localIncomeTax, e.localIncomeTax, tc.id + ' localIncomeTax');

    // appliedRate 검증
    if (e.appliedRate === null) {
      assertEq(s.appliedRate, null, tc.id + ' appliedRate === null (terminateAt2)');
    } else if (Number.isInteger(e.appliedRateBracket)) {
      assert(s.appliedRate !== null, tc.id + ' appliedRate !== null');
      if (s.appliedRate) {
        assertEq(s.appliedRate.bracket, e.appliedRateBracket, tc.id + ' appliedRate.bracket');
      }
    }

    // v0.2 신규 10개 필드
    assertEq(s.is1Se1House, e.is1Se1House, tc.id + ' is1Se1House');
    assertEq(s.isHighValueHouse, e.isHighValueHouse, tc.id + ' isHighValueHouse');
    assertEq(s.terminateAt2, e.terminateAt2, tc.id + ' terminateAt2');
    assertEq(s.appliedDeductionTable, e.appliedDeductionTable, tc.id + ' appliedDeductionTable');
    assertEq(s.holdingYears, e.holdingYears, tc.id + ' holdingYears');
    assertEq(s.residenceYears, e.residenceYears, tc.id + ' residenceYears');
    assertEq(s.holdingRate, e.holdingRate, tc.id + ' holdingRate');
    assertEq(s.residenceRate, e.residenceRate, tc.id + ' residenceRate');
    assertEq(s.totalRate, e.totalRate, tc.id + ' totalRate');

    // allocationRatio (TC-006/008/010는 1.0 명시, TC-007/009는 비율)
    if (typeof e.allocationRatio === 'number') {
      assertNear(s.allocationRatio, e.allocationRatio, 1e-9, tc.id + ' allocationRatio');
    }

    // metrics 미러링
    assertEq(result.metrics.totalTax, e.totalTax, tc.id + ' metrics.totalTax === steps.totalTax');
    assertEq(result.metrics.netAfterTaxSaleAmount, e.netAfterTaxSaleAmount,
             tc.id + ' metrics.netAfterTaxSaleAmount');

    // 정수성
    assert(Number.isInteger(s.totalTax), tc.id + ' totalTax is integer');
    assert(Number.isInteger(s.taxableGain), tc.id + ' taxableGain is integer');
    assert(Number.isInteger(s.longTermDeduction), tc.id + ' longTermDeduction is integer');
    assert(Number.isInteger(s.netAfterTaxSaleAmount), tc.id + ' netAfterTaxSaleAmount is integer');
  });

  // ================================================================
  // 그룹 11 — TC-001~005 v0.1 회귀 (입력 패치 적용 후, 자동 보정 폴백 검증)
  // ================================================================
  setGroup('그룹11 v0.1 입력 패치');

  // 명시 패치 (householdHouseCount: 2)로 v0.1 정답값 보존 검증
  TC_GOLDEN_V01.forEach(function (tc) {
    var caseData = buildCaseData(tc.input, { householdHouseCount: 2 });
    var result = taxEngine.calculateSingleTransfer(caseData);
    assertEq(result.steps.totalTax, tc.expected.totalTax,
             tc.id + ' (v0.1 회귀, 다주택 명시): totalTax === ' + tc.expected.totalTax);
    assertEq(result.steps.is1Se1House, false,
             tc.id + ' (v0.1 회귀, 다주택 명시): is1Se1House=false');
  });

  // 자동 보정 폴백 검증 — householdHouseCount 누락 시 candidateHouseIds.length(=1)로 보정 →
  // TC-001~005는 1세대1주택 분기에 진입 가능 (acquisitionRegulated=false라 거주요건 면제)
  // TC-001/004 (보유≥2 + 12억 이하) → 비과세 적용 → totalTax=0
  // TC-002 (보유<2년) → 비과세 미적용 → 일반과세 (totalTax 동일)
  var cdAuto001 = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cdAuto001.householdHouseCount;
  var rAuto001 = taxEngine.calculateSingleTransfer(cdAuto001);
  assertEq(rAuto001.steps.is1Se1House, true,
           'TC-001 자동 보정 폴백: candidateHouseIds(=1) → 1세대1주택 비과세 진입');
  assertEq(rAuto001.steps.totalTax, 0,
           'TC-001 자동 보정 폴백: 비과세 적용 → totalTax=0');

  var cdAuto002 = buildCaseData(TC_GOLDEN_V01[1].input);
  delete cdAuto002.householdHouseCount;
  var rAuto002 = taxEngine.calculateSingleTransfer(cdAuto002);
  assertEq(rAuto002.steps.totalTax, TC_GOLDEN_V01[1].expected.totalTax,
           'TC-002 자동 보정 폴백: 보유<2년 → 비과세 미적용 → 일반과세 동일');

  // ================================================================
  // 그룹 12 — 단계 2·3·4 단위 함수 (v0.2 신규 보조 함수)
  // ================================================================
  setGroup('그룹12 단계2·3·4 단위');

  // ─── check1Se1HouseExemption ──────────────────────────────────
  // (a) 다주택
  var ex_multi = taxEngine.check1Se1HouseExemption({
    householdHouseCount: 2, acquisitionDate: '2020-01-15', saleDate: '2026-08-31',
    acquisitionRegulated: false, residenceMonths: 0, salePrice: 800000000
  });
  assertEq(ex_multi.is1Se1House, false, 'check1Se1: 다주택 → is1Se1House=false');
  assertEq(ex_multi.terminateAt2, false, 'check1Se1: 다주택 → terminateAt2=false');
  assertEq(ex_multi.reason, 'MULTI_HOUSE', 'check1Se1: 다주택 reason=MULTI_HOUSE');

  // (b) 보유 < 2년
  var ex_short = taxEngine.check1Se1HouseExemption({
    householdHouseCount: 1, acquisitionDate: '2025-06-01', saleDate: '2026-08-31',
    acquisitionRegulated: false, residenceMonths: 14, salePrice: 800000000
  });
  assertEq(ex_short.is1Se1House, false, 'check1Se1: 보유 1.2년 → is1Se1House=false');
  assertEq(ex_short.reason, 'HOLDING_LT_2Y', 'check1Se1: 보유<2년 reason=HOLDING_LT_2Y');

  // (c) 조정대상 + 거주 < 24M
  var ex_resReg = taxEngine.check1Se1HouseExemption({
    householdHouseCount: 1, acquisitionDate: '2020-01-15', saleDate: '2026-08-31',
    acquisitionRegulated: true, residenceMonths: 12, salePrice: 800000000
  });
  assertEq(ex_resReg.is1Se1House, false, 'check1Se1: 조정대상+거주<24M → is1Se1House=false');
  assertEq(ex_resReg.reason, 'RESIDENCE_LT_24M_REGULATED',
           'check1Se1: 조정대상+거주<24M reason=RESIDENCE_LT_24M_REGULATED');

  // (e) 비조정대상 + 보유 5년 + 12억 이하 → 전액 비과세
  var ex_under12b = taxEngine.check1Se1HouseExemption({
    householdHouseCount: 1, acquisitionDate: '2021-04-30', saleDate: '2026-08-31',
    acquisitionRegulated: false, residenceMonths: 60, salePrice: 1000000000
  });
  assertEq(ex_under12b.is1Se1House, true, 'check1Se1: 비조정+5년+10억 → is1Se1House=true');
  assertEq(ex_under12b.terminateAt2, true, 'check1Se1: 12억 이하 → terminateAt2=true');
  assertEq(ex_under12b.isHighValueHouse, false, 'check1Se1: 12억 이하 → isHighValueHouse=false');
  assertEq(ex_under12b.holdingYears, 5, 'check1Se1: holdingYears=5');
  assertEq(ex_under12b.residenceYears, 5, 'check1Se1: residenceYears=5');
  assertEq(ex_under12b.reason, 'EXEMPT_UNDER_12B', 'check1Se1: reason=EXEMPT_UNDER_12B');

  // (f) 12억 초과 → 안분 진입
  var ex_high = taxEngine.check1Se1HouseExemption({
    householdHouseCount: 1, acquisitionDate: '2018-06-15', saleDate: '2026-09-30',
    acquisitionRegulated: false, residenceMonths: 96, salePrice: 1500000000
  });
  assertEq(ex_high.is1Se1House, true, 'check1Se1: 1세대1주택+12억 초과 → is1Se1House=true');
  assertEq(ex_high.terminateAt2, false, 'check1Se1: 12억 초과 → terminateAt2=false');
  assertEq(ex_high.isHighValueHouse, true, 'check1Se1: 12억 초과 → isHighValueHouse=true');
  assertEq(ex_high.holdingYears, 8, 'check1Se1: holdingYears=8');
  assertEq(ex_high.reason, 'HIGH_VALUE_ALLOCATION', 'check1Se1: reason=HIGH_VALUE_ALLOCATION');

  // 조정대상 + 거주 ≥ 24M + 보유 5년 → is1Se1House=true
  var ex_regOk = taxEngine.check1Se1HouseExemption({
    householdHouseCount: 1, acquisitionDate: '2020-01-15', saleDate: '2026-08-31',
    acquisitionRegulated: true, residenceMonths: 24, salePrice: 800000000
  });
  assertEq(ex_regOk.is1Se1House, true, 'check1Se1: 조정+거주24M+보유6.7년 → is1Se1House=true');

  // ─── calculateHighValuePortion ─────────────────────────────────
  // 12억 이하 입력 시 throw
  expectThrow(function () {
    taxEngine.calculateHighValuePortion({ transferGain: 100000000, salePrice: 1000000000 });
  }, 'calculateHighValuePortion: 12억 이하 입력 시 throw');

  // 14억 → allocationRatio = 1/7
  var hp14 = taxEngine.calculateHighValuePortion({ transferGain: 700000000, salePrice: 1400000000 });
  assertNear(hp14.allocationRatio, 1/7, 1e-9, 'calculateHighValuePortion: 14억 → ratio=1/7');
  assert(Number.isInteger(hp14.taxableGain), 'calculateHighValuePortion: taxableGain 정수');
  assertEq(hp14.taxableGain, Math.floor(700000000 * (1/7)),
           'calculateHighValuePortion: 14억 taxableGain (Math.floor)');

  // 15억 → allocationRatio = 0.2
  var hp15 = taxEngine.calculateHighValuePortion({ transferGain: 670000000, salePrice: 1500000000 });
  assertNear(hp15.allocationRatio, 0.2, 1e-9, 'calculateHighValuePortion: 15억 → ratio=0.20');
  assertEq(hp15.taxableGain, 134000000, 'calculateHighValuePortion: 15억 taxableGain=134,000,000');

  // ─── calculateLongTermDeduction ────────────────────────────────
  // 다주택 + 보유 12년 → 표 1, 24%
  var ltd_t1 = taxEngine.calculateLongTermDeduction({
    taxableGain: 480000000, holdingYears: 12, residenceYears: 0,
    is1Se1House: false, isHighValueHouse: false
  });
  assertEq(ltd_t1.appliedDeductionTable, 1, 'calculateLTD: 다주택 → 표 1');
  assertEq(ltd_t1.holdingRate, 0.24, 'calculateLTD: 표 1 보유 12년 → 24%');
  assertEq(ltd_t1.totalRate, 0.24, 'calculateLTD: 표 1 totalRate=0.24');
  assertEq(ltd_t1.longTermDeduction, 115200000, 'calculateLTD: 표 1 longTermDeduction');

  // 1세대1주택 + 12억 초과 + 보유 8년 + 거주 8년 → 표 2 64%
  var ltd_t2 = taxEngine.calculateLongTermDeduction({
    taxableGain: 134000000, holdingYears: 8, residenceYears: 8,
    is1Se1House: true, isHighValueHouse: true
  });
  assertEq(ltd_t2.appliedDeductionTable, 2, 'calculateLTD: 1세대+12억 초과 → 표 2');
  assertEq(ltd_t2.holdingRate, 0.32, 'calculateLTD: 표 2 보유 8년 → 32%');
  assertEq(ltd_t2.residenceRate, 0.32, 'calculateLTD: 표 2 거주 8년 → 32%');
  assertEq(ltd_t2.totalRate, 0.64, 'calculateLTD: 표 2 totalRate=0.64');
  assertEq(ltd_t2.longTermDeduction, 85760000, 'calculateLTD: 표 2 longTermDeduction');

  // 1세대1주택 + 12억 초과 + 보유 10년 + 거주 10년 → 표 2 80% (최대)
  var ltd_t2max = taxEngine.calculateLongTermDeduction({
    taxableGain: 96428571, holdingYears: 10, residenceYears: 10,
    is1Se1House: true, isHighValueHouse: true
  });
  assertEq(ltd_t2max.totalRate, 0.80, 'calculateLTD: 표 2 최대 80%');
  assertEq(ltd_t2max.longTermDeduction, 77142856, 'calculateLTD: 표 2 80% longTermDeduction (TC-009)');

  // 다주택 + 보유 5년 → 표 1, 10%
  var ltd_t1_5y = taxEngine.calculateLongTermDeduction({
    taxableGain: 385000000, holdingYears: 5, residenceYears: 0,
    is1Se1House: false, isHighValueHouse: false
  });
  assertEq(ltd_t1_5y.totalRate, 0.10, 'calculateLTD: 표 1 보유 5년 → 10% (TC-010)');
  assertEq(ltd_t1_5y.longTermDeduction, 38500000, 'calculateLTD: 표 1 5년 longTermDeduction');

  // 1세대1주택 + 12억 초과 + 보유 2년 → appliedDeductionTable=null, totalRate=0
  var ltd_lt3y = taxEngine.calculateLongTermDeduction({
    taxableGain: 100000000, holdingYears: 2, residenceYears: 2,
    is1Se1House: true, isHighValueHouse: true
  });
  assertEq(ltd_lt3y.appliedDeductionTable, null, 'calculateLTD: 보유<3년 → null');
  assertEq(ltd_lt3y.totalRate, 0, 'calculateLTD: 보유<3년 → totalRate=0');
  assertEq(ltd_lt3y.longTermDeduction, 0, 'calculateLTD: 보유<3년 → longTermDeduction=0');

  // longTermDeduction 정수 보장
  assert(Number.isInteger(ltd_t1.longTermDeduction), 'calculateLTD: 표 1 정수');
  assert(Number.isInteger(ltd_t2.longTermDeduction), 'calculateLTD: 표 2 정수');
  assert(Number.isInteger(ltd_t2max.longTermDeduction), 'calculateLTD: 표 2 최대 정수');

  // 입력 객체 변경 없음 (deep equal)
  var checkInput = {
    householdHouseCount: 1, acquisitionDate: '2018-06-15', saleDate: '2026-09-30',
    acquisitionRegulated: false, residenceMonths: 96, salePrice: 1500000000
  };
  var snapInput = JSON.stringify(checkInput);
  taxEngine.check1Se1HouseExemption(checkInput);
  assertEq(JSON.stringify(checkInput), snapInput,
           'check1Se1HouseExemption은 input을 변경하지 않는다');

  var hpInput = { transferGain: 700000000, salePrice: 1400000000 };
  var snapHp = JSON.stringify(hpInput);
  taxEngine.calculateHighValuePortion(hpInput);
  assertEq(JSON.stringify(hpInput), snapHp,
           'calculateHighValuePortion은 input을 변경하지 않는다');

  var ltdInput = {
    taxableGain: 134000000, holdingYears: 8, residenceYears: 8,
    is1Se1House: true, isHighValueHouse: true
  };
  var snapLtd = JSON.stringify(ltdInput);
  taxEngine.calculateLongTermDeduction(ltdInput);
  assertEq(JSON.stringify(ltdInput), snapLtd,
           'calculateLongTermDeduction은 input을 변경하지 않는다');

  // computeHoldingYears 단위
  assertEq(taxEngine.computeHoldingYears('2021-04-30', '2026-08-31'), 5,
           'computeHoldingYears: 2021-04-30 → 2026-08-31 = 5년');
  assertEq(taxEngine.computeHoldingYears('2018-06-15', '2026-09-30'), 8,
           'computeHoldingYears: 2018-06-15 → 2026-09-30 = 8년');
  assertEq(taxEngine.computeHoldingYears('2014-05-20', '2026-08-15'), 12,
           'computeHoldingYears: 2014-05-20 → 2026-08-15 = 12년 (TC-008)');
  assertEq(taxEngine.computeHoldingYears('2025-06-01', '2026-08-31'), 1,
           'computeHoldingYears: 1.2년 → 1');

  // ================================================================
  // 그룹 13 — issueFlag 카탈로그 18종 + terminateAt2 0/null + 자동 보정
  // ================================================================
  setGroup('그룹13 issueFlag v0.2');

  var rTC006 = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V02[0].input, TC_GOLDEN_V02[0].overrides)
  );
  var rTC007 = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V02[1].input, TC_GOLDEN_V02[1].overrides)
  );
  var rTC008 = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V02[2].input, TC_GOLDEN_V02[2].overrides)
  );
  var rTC009 = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V02[3].input, TC_GOLDEN_V02[3].overrides)
  );
  var rTC010 = taxEngine.calculateSingleTransfer(
    buildCaseData(TC_GOLDEN_V02[4].input, TC_GOLDEN_V02[4].overrides)
  );

  // ─── v0.2 신규 5종 ─────────────────────────────────────────────
  // IS_1SE_1HOUSE
  assert(hasFlag(rTC006, 'IS_1SE_1HOUSE'), 'TC-006 IS_1SE_1HOUSE 발동');
  assert(hasFlag(rTC007, 'IS_1SE_1HOUSE'), 'TC-007 IS_1SE_1HOUSE 발동');
  assert(hasFlag(rTC009, 'IS_1SE_1HOUSE'), 'TC-009 IS_1SE_1HOUSE 발동');
  assert(!hasFlag(rTC008, 'IS_1SE_1HOUSE'), 'TC-008 IS_1SE_1HOUSE 미발동 (다주택)');
  assert(!hasFlag(rTC010, 'IS_1SE_1HOUSE'), 'TC-010 IS_1SE_1HOUSE 미발동 (다주택)');

  // IS_HIGH_VALUE_HOUSE
  assert(hasFlag(rTC007, 'IS_HIGH_VALUE_HOUSE'), 'TC-007 IS_HIGH_VALUE_HOUSE 발동');
  assert(hasFlag(rTC009, 'IS_HIGH_VALUE_HOUSE'), 'TC-009 IS_HIGH_VALUE_HOUSE 발동');
  assert(!hasFlag(rTC006, 'IS_HIGH_VALUE_HOUSE'), 'TC-006 IS_HIGH_VALUE_HOUSE 미발동 (12억 이하)');
  assert(!hasFlag(rTC008, 'IS_HIGH_VALUE_HOUSE'), 'TC-008 IS_HIGH_VALUE_HOUSE 미발동 (다주택)');

  // LONG_TERM_DEDUCTION_TABLE_1
  assert(hasFlag(rTC008, 'LONG_TERM_DEDUCTION_TABLE_1'), 'TC-008 LONG_TERM_DEDUCTION_TABLE_1 발동');
  assert(hasFlag(rTC010, 'LONG_TERM_DEDUCTION_TABLE_1'), 'TC-010 LONG_TERM_DEDUCTION_TABLE_1 발동');
  assert(!hasFlag(rTC007, 'LONG_TERM_DEDUCTION_TABLE_1'), 'TC-007 LONG_TERM_DEDUCTION_TABLE_1 미발동');

  // LONG_TERM_DEDUCTION_TABLE_2
  assert(hasFlag(rTC007, 'LONG_TERM_DEDUCTION_TABLE_2'), 'TC-007 LONG_TERM_DEDUCTION_TABLE_2 발동');
  assert(hasFlag(rTC009, 'LONG_TERM_DEDUCTION_TABLE_2'), 'TC-009 LONG_TERM_DEDUCTION_TABLE_2 발동');
  assert(!hasFlag(rTC008, 'LONG_TERM_DEDUCTION_TABLE_2'), 'TC-008 LONG_TERM_DEDUCTION_TABLE_2 미발동');

  // ONE_TIME_2HOUSES_NOT_APPLIED
  assert(hasFlag(rTC010, 'ONE_TIME_2HOUSES_NOT_APPLIED'),
         'TC-010 ONE_TIME_2HOUSES_NOT_APPLIED 발동 (warning)');
  var flagOT = findFlag(rTC010, 'ONE_TIME_2HOUSES_NOT_APPLIED');
  assertEq(flagOT.severity, 'warning', 'TC-010 ONE_TIME_2HOUSES_NOT_APPLIED severity=warning');
  assert(!hasFlag(rTC008, 'ONE_TIME_2HOUSES_NOT_APPLIED'),
         'TC-008 ONE_TIME_2HOUSES_NOT_APPLIED 미발동 (isOneTimeTwoHouses=false)');

  // ─── v0.2 보조 3종 ─────────────────────────────────────────────
  // RESIDENCE_MONTHS_USER_INPUT — 항상
  assert(hasFlag(rTC006, 'RESIDENCE_MONTHS_USER_INPUT'), 'TC-006 RESIDENCE_MONTHS_USER_INPUT 발동');
  assert(hasFlag(rTC008, 'RESIDENCE_MONTHS_USER_INPUT'), 'TC-008 RESIDENCE_MONTHS_USER_INPUT 발동');

  // RESIDENCE_EXEMPTION_NOT_HANDLED — 조정대상 + 거주<24M
  var rResReg = taxEngine.calculateSingleTransfer(buildCaseData(
    {
      acquisitionDate: '2020-01-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
      saleDate: '2026-08-31', salePrice: 800000000, basicDeductionUsed: false,
      acquisitionRegulated: true
    },
    { householdHouseCount: 1, residenceMonths: 12, acquisitionRegulated: true }
  ));
  assert(hasFlag(rResReg, 'RESIDENCE_EXEMPTION_NOT_HANDLED'),
         'acquisitionRegulated + 거주 12M → RESIDENCE_EXEMPTION_NOT_HANDLED 발동');
  assert(!hasFlag(rTC006, 'RESIDENCE_EXEMPTION_NOT_HANDLED'),
         'TC-006 RESIDENCE_EXEMPTION_NOT_HANDLED 미발동 (비조정대상)');

  // LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2
  var rT2lt3y = taxEngine.calculateSingleTransfer(buildCaseData(
    {
      acquisitionDate: '2024-04-30', acquisitionPrice: 700000000, necessaryExpense: 25000000,
      saleDate: '2026-09-15', salePrice: 1400000000, basicDeductionUsed: false
    },
    { householdHouseCount: 1, residenceMonths: 24 }
  ));
  // 보유 2년 4개월 → holdingYears=2 → < 2년 비과세 차단? 보유 2년 이상이지만 2.4년 → holdingYears=2
  // 보유 2년 → NON_TAXABLE_HOLDING_MIN_YEARS=2 충족 → is1Se1House=true → 12억 초과 → isHighValueHouse=true
  // → 단계 4: 보유<3년 → null (LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2 발동)
  assert(hasFlag(rT2lt3y, 'LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2'),
         '1세대+12억 초과+보유<3년 → LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2 발동');

  // ─── v0.1 변경 5종 (이미 그룹 5에서 검증, v0.2 새 케이스로 추가 검증) ─
  // POSSIBLE_NON_TAXATION_1H1H — v0.2 발동조건: !is1Se1House + householdHouseCount=1 + 보유≥2 + 거주≥24M
  // 어떻게 발동? householdHouseCount=1인데 is1Se1House=false인 케이스 = 조정대상+거주<24M 또는 보유<2년
  // → "is1Se1House=false && householdHouseCount===1 && holdingYears>=2 && residenceMonths>=24"
  // 이 조합은 사실상 (조정대상+거주≥24M) 이지만 비과세 적용됐으면 is1Se1House=true.
  // → 비과세 미적용 + 1세대1주택 + 보유≥2 + 거주≥24M 조합 자체가 거의 발생 안 함.
  // 한 가지 케이스: residenceMonths < NON_TAXABLE_RESIDENCE_MIN_YEARS*12=24 인데 ≥ 24 검증 → 모순.
  // 결국 v0.2에서 본 issueFlag는 거의 발동하지 않음 (의도된 변경).
  // 미발동 검증 (TC-006/007/009 모두 is1Se1House=true)
  assert(!hasFlag(rTC006, 'POSSIBLE_NON_TAXATION_1H1H'), 'TC-006 POSSIBLE_NON_TAXATION_1H1H 미발동');
  assert(!hasFlag(rTC007, 'POSSIBLE_NON_TAXATION_1H1H'), 'TC-007 POSSIBLE_NON_TAXATION_1H1H 미발동');

  // HIGH_VALUE_HOUSE — v0.2 변경: !is1Se1House + 12억 초과
  // TC-008 (다주택, 10억) 미발동
  assert(!hasFlag(rTC008, 'HIGH_VALUE_HOUSE'), 'TC-008 HIGH_VALUE_HOUSE 미발동 (10억)');
  // 다주택 + 12억 초과 케이스
  var rMultiHigh = taxEngine.calculateSingleTransfer(buildCaseData(
    {
      acquisitionDate: '2014-05-20', acquisitionPrice: 500000000, necessaryExpense: 20000000,
      saleDate: '2026-08-15', salePrice: 1300000000, basicDeductionUsed: false
    },
    { householdHouseCount: 2, residenceMonths: 0 }
  ));
  assert(hasFlag(rMultiHigh, 'HIGH_VALUE_HOUSE'), '다주택 + 13억 → HIGH_VALUE_HOUSE 발동');
  // TC-007 (1세대1주택 + 15억) 미발동 (IS_HIGH_VALUE_HOUSE로 대체)
  assert(!hasFlag(rTC007, 'HIGH_VALUE_HOUSE'), 'TC-007 HIGH_VALUE_HOUSE 미발동 (IS_HIGH_VALUE_HOUSE 대체)');

  // ─── HOLDING_PERIOD_BOUNDARY 확장 (1·2·3·15년 ±3일) ─────────────
  // 3년 경계 ±3일
  var r3yBoundary = taxEngine.calculateSingleTransfer(buildCaseData(
    {
      acquisitionDate: '2023-05-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
      saleDate: '2026-05-16', salePrice: 800000000, basicDeductionUsed: false
    },
    { householdHouseCount: 2 }
  ));
  assert(hasFlag(r3yBoundary, 'HOLDING_PERIOD_BOUNDARY'),
         '보유 3년 경계 +1일 → HOLDING_PERIOD_BOUNDARY 발동 (v0.2 확장)');

  // 15년 경계 ±3일
  var r15yBoundary = taxEngine.calculateSingleTransfer(buildCaseData(
    {
      acquisitionDate: '2011-05-15', acquisitionPrice: 500000000, necessaryExpense: 10000000,
      saleDate: '2026-05-17', salePrice: 800000000, basicDeductionUsed: false
    },
    { householdHouseCount: 2 }
  ));
  assert(hasFlag(r15yBoundary, 'HOLDING_PERIOD_BOUNDARY'),
         '보유 15년 경계 +2일 → HOLDING_PERIOD_BOUNDARY 발동 (v0.2 확장)');

  // ─── LONG_TERM_DEDUCTION_NOT_APPLIED 폐기 검증 ─────────────────
  // v0.2에서 본 issueFlag는 어떤 케이스에서도 발동하지 않아야 함
  TC_GOLDEN_V02.forEach(function (tc) {
    var r = taxEngine.calculateSingleTransfer(buildCaseData(tc.input, tc.overrides));
    assert(!hasFlag(r, 'LONG_TERM_DEDUCTION_NOT_APPLIED'),
           tc.id + ' LONG_TERM_DEDUCTION_NOT_APPLIED 미발동 (v0.2 폐기)');
  });

  // ─── 자동 보정 issueFlag 발동 ─────────────────────────────────
  var cdAutoCorr = buildCaseData(TC_GOLDEN_V01[0].input);
  delete cdAutoCorr.householdHouseCount;
  delete cdAutoCorr.houses[0].residenceMonths;
  var rAutoCorr = taxEngine.calculateSingleTransfer(cdAutoCorr);
  assert(hasFlag(rAutoCorr, 'HOUSEHOLD_COUNT_INFERRED'),
         'householdHouseCount 자동 보정 → HOUSEHOLD_COUNT_INFERRED 발동');
  assert(hasFlag(rAutoCorr, 'RESIDENCE_MONTHS_DEFAULTED_ZERO'),
         'residenceMonths 자동 보정 → RESIDENCE_MONTHS_DEFAULTED_ZERO 발동');

  // ─── terminateAt2 후속 단계 0/null 정책 (TC-006) ────────────────
  assertEq(rTC006.steps.taxableGain, 0, 'TC-006 terminateAt2: taxableGain=0');
  assertEq(rTC006.steps.longTermDeduction, 0, 'TC-006 terminateAt2: longTermDeduction=0');
  assertEq(rTC006.steps.basicDeduction, 0, 'TC-006 terminateAt2: basicDeduction=0');
  assertEq(rTC006.steps.taxBase, 0, 'TC-006 terminateAt2: taxBase=0');
  assertEq(rTC006.steps.calculatedTax, 0, 'TC-006 terminateAt2: calculatedTax=0');
  assertEq(rTC006.steps.localIncomeTax, 0, 'TC-006 terminateAt2: localIncomeTax=0');
  assertEq(rTC006.steps.totalTax, 0, 'TC-006 terminateAt2: totalTax=0');
  assertEq(rTC006.steps.appliedRate, null, 'TC-006 terminateAt2: appliedRate=null');
  assertEq(rTC006.steps.appliedDeductionTable, null, 'TC-006 terminateAt2: appliedDeductionTable=null');
  assertEq(rTC006.steps.holdingRate, 0, 'TC-006 terminateAt2: holdingRate=0');
  assertEq(rTC006.steps.residenceRate, 0, 'TC-006 terminateAt2: residenceRate=0');
  assertEq(rTC006.steps.totalRate, 0, 'TC-006 terminateAt2: totalRate=0');
  assertEq(rTC006.steps.netAfterTaxSaleAmount, 1000000000,
           'TC-006 terminateAt2: netAfterTaxSaleAmount=salePrice');
  assertEq(rTC006.metrics.effectiveTaxRate, 0,
           'TC-006 terminateAt2: effectiveTaxRate=0');
  // undefined 누락 금지
  assert(rTC006.steps.appliedDeductionTable !== undefined,
         'TC-006 appliedDeductionTable !== undefined');
  assert(rTC006.steps.holdingRate !== undefined,
         'TC-006 holdingRate !== undefined');

  // ================================================================
  // v0.3-A 신규 회귀 테스트 그룹 A~F (작업지시서 06 §10-3)
  // ================================================================

  // ----------------------------------------------------------------
  // TC-011~014 caseData 빌더 (v0.3-A 골든셋, 작업지시서 06 §10-2)
  // 모든 4건 공통 베이스: salePrice=10억, acquisitionPrice=5억, 필요경비 2천만,
  //                       acquisitionDate=2014-05-01, saleDate=2026-05-15, 보유 12년
  // ----------------------------------------------------------------
  function buildV03ACase(householdHouseCount, saleRegulated) {
    return {
      caseId: null, baseYear: 2026, householdMembers: 1,
      householdHouseCount: householdHouseCount,
      isOneTimeTwoHouses: false, basicDeductionUsed: false,
      houses: [{
        id: 'A', nickname: '주택 A', location: '',
        acquisitionDate:  '2014-05-01',
        acquisitionPrice:  500000000,
        necessaryExpense:   20000000,
        acquisitionRegulated: false,
        residenceMonths:   0,
        livingNow:         false,
        expectedSaleDate:  '2026-05-15',
        expectedSalePrice: 1000000000,
        saleRegulated:     saleRegulated
      }],
      salePlan: {
        targetSaleCount: 1, candidateHouseIds: ['A'], fixedSaleHouseIds: ['A'],
        excludedHouseIds: [], allowSystemToChooseSaleTargets: false,
        allowYearSplitting: false, targetSaleYears: [2026],
        saleDate: '2026-05-15'
      }
    };
  }

  // ----------------------------------------------------------------
  // 그룹 v0.3-A_A. selfTest 부트스트랩 + 가드 2-A 검증 (§10-3-1)
  // ----------------------------------------------------------------
  setGroup('그룹A v0.3-A selfTest');

  var stV3 = taxEngine.selfTest();
  assertEq(stV3.ok, true, 'selfTest().ok === true');
  assertEq(stV3.taxRulesSelfTest.ok, true, 'taxRulesSelfTest.ok === true');
  assertEq(stV3.sanityChecks.ok, true, 'sanityChecks.ok === true');
  assertEq(stV3.sanityChecks.checks.length, 8,
    'sanityChecks 8건 (v0.2 6건 + TC-011·012)');
  // sanityChecks.results 별칭 검증
  assert(Array.isArray(stV3.sanityChecks.results) &&
         stV3.sanityChecks.results.length === 8,
    'sanityChecks.results 별칭 (8건)');
  // sanity 8건 ID 명시 검증
  var stIds = stV3.sanityChecks.checks.map(function (c) { return c.id; });
  ['TC-001','TC-003','TC-005','TC-006','TC-008','TC-010','TC-011','TC-012'].forEach(function (id) {
    assert(stIds.indexOf(id) >= 0, 'sanityChecks 포함: ' + id);
  });
  assertEq(taxEngine.ENGINE_VERSION, 'v0.3.0-A', 'ENGINE_VERSION === "v0.3.0-A"');
  assertEq(typeof taxEngine.isHeavyTaxationApplicable, 'function',
    'isHeavyTaxationApplicable 노출');

  // ----------------------------------------------------------------
  // 그룹 v0.3-A_B. isHeavyTaxationApplicable 4조건 검증 (§10-3-2)
  // ----------------------------------------------------------------
  setGroup('그룹B v0.3-A heavyTaxation 평가');

  // 4조건 모두 true → true (TC-011 케이스)
  assertEq(taxEngine.isHeavyTaxationApplicable(buildV03ACase(2, true), { is1Se1House: false }),
    true, '4조건 모두 true → true');

  // condition1 차단 (단주택)
  assertEq(taxEngine.isHeavyTaxationApplicable(buildV03ACase(1, true), { is1Se1House: false }),
    false, 'condition1 차단 (단주택) → false');

  // condition2 차단 (saleRegulated=false)
  assertEq(taxEngine.isHeavyTaxationApplicable(buildV03ACase(2, false), { is1Se1House: false }),
    false, 'condition2 차단 (saleRegulated=false) → false');

  // condition3 차단 (saleDate < 2026-05-10)
  var earlyCase = buildV03ACase(2, true);
  earlyCase.salePlan.saleDate = '2026-05-09';
  earlyCase.houses[0].expectedSaleDate = '2026-05-09';
  assertEq(taxEngine.isHeavyTaxationApplicable(earlyCase, { is1Se1House: false }),
    false, 'condition3 차단 (saleDate < 2026-05-10) → false');

  // condition4 차단 (is1Se1House=true)
  assertEq(taxEngine.isHeavyTaxationApplicable(buildV03ACase(2, true), { is1Se1House: true }),
    false, 'condition4 차단 (is1Se1House=true) → false');

  // intermediates 누락 시 안전 false
  assertEq(taxEngine.isHeavyTaxationApplicable(buildV03ACase(2, true), {}),
    false, 'intermediates.is1Se1House 누락 → false (방어)');

  // ----------------------------------------------------------------
  // 그룹 v0.3-A_C. 단계 4 변경 검증 (장특공 배제) (§10-3-3)
  // ----------------------------------------------------------------
  setGroup('그룹C v0.3-A 단계4 장특공 배제');

  var rTC011 = taxEngine.calculateSingleTransfer(buildV03ACase(2, true));
  // 중과 발동 시 장특공 0
  assertEq(rTC011.steps.longTermDeduction, 0,
    'TC-011 중과 발동 → longTermDeduction === 0');
  assertEq(rTC011.steps.appliedDeductionTable, null,
    'TC-011 중과 발동 → appliedDeductionTable === null');
  assertEq(rTC011.steps.holdingRate, 0,
    'TC-011 중과 발동 → holdingRate === 0');
  assertEq(rTC011.steps.residenceRate, 0,
    'TC-011 중과 발동 → residenceRate === 0');
  assertEq(rTC011.steps.totalRate, 0,
    'TC-011 중과 발동 → totalRate === 0');
  assertEq(rTC011.steps.heavyRateAddition, 0.20,
    'TC-011 중과 발동 → heavyRateAddition === 0.20');

  // 중과 미발동 (TC-013) → v0.2 결과 그대로
  var rTC013 = taxEngine.calculateSingleTransfer(buildV03ACase(2, false));
  assertEq(rTC013.steps.isHeavyTaxation, false,
    'TC-013 saleRegulated=false → isHeavyTaxation === false');
  assertEq(rTC013.steps.heavyRateAddition, null,
    'TC-013 중과 미발동 → heavyRateAddition === null');
  assertEq(rTC013.steps.appliedDeductionTable, 1,
    'TC-013 중과 미발동 → appliedDeductionTable === 1 (v0.2 표 1)');

  // 중과 + 보유 ≥ 3년 → LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY 발동
  assert(hasFlag(rTC011, 'LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY'),
    'TC-011 중과 + 보유 12년 → LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY 발동');

  // ----------------------------------------------------------------
  // 그룹 v0.3-A_D. 단계 9 변경 검증 (가산세율 동적 재계산 + max 비교) (§10-3-4)
  // ----------------------------------------------------------------
  setGroup('그룹D v0.3-A 단계9 가산세율');

  // 9-A-1: 중과 + over2y (TC-011·012)
  assertEq(rTC011.steps.appliedRate.type, 'progressive_with_heavy',
    'TC-011 over2y+중과 → appliedRate.type === "progressive_with_heavy"');
  assertEq(typeof rTC011.steps.appliedRate.bracket, 'number',
    'TC-011 appliedRate.bracket 채워짐 (number)');
  assertEq(rTC011.steps.appliedRate.addition, 0.20,
    'TC-011 appliedRate.addition === 0.20 === heavyRateAddition');
  assertEq(rTC011.steps.shortTermTax, null,
    'TC-011 over2y → shortTermTax === null');
  assertEq(rTC011.steps.heavyProgressiveTax, null,
    'TC-011 over2y → heavyProgressiveTax === null');

  // 9-A-2: 중과 + under2y (max 비교)
  // 보유 1년 6개월 (2025-05-01 → 2026-12-15) — 보유 < 2년, 중과
  var underCase = buildV03ACase(2, true);
  underCase.houses[0].acquisitionDate = '2025-05-01';
  underCase.houses[0].expectedSaleDate = '2026-12-15';
  underCase.salePlan.saleDate = '2026-12-15';
  var rUnder = taxEngine.calculateSingleTransfer(underCase);
  assertEq(rUnder.steps.holdingPeriodBranch, 'under2y',
    'underCase: holdingPeriodBranch === "under2y"');
  assertEq(rUnder.steps.isHeavyTaxation, true,
    'underCase: isHeavyTaxation === true');
  assert(typeof rUnder.steps.shortTermTax === 'number',
    'underCase: shortTermTax !== null (number)');
  assert(typeof rUnder.steps.heavyProgressiveTax === 'number',
    'underCase: heavyProgressiveTax !== null (number)');
  assertEq(rUnder.steps.calculatedTax,
           Math.max(rUnder.steps.shortTermTax, rUnder.steps.heavyProgressiveTax),
    'underCase: calculatedTax === max(shortTermTax, heavyProgressiveTax)');
  assertEq(rUnder.steps.appliedRate.type, 'short_term_60or70_vs_heavy',
    'underCase: appliedRate.type === "short_term_60or70_vs_heavy"');
  assertEq(rUnder.steps.appliedRate.comparedHeavy, true,
    'underCase: appliedRate.comparedHeavy === true');
  assert(rUnder.steps.appliedRate.chosen === 'short_term' ||
         rUnder.steps.appliedRate.chosen === 'heavy_progressive',
    'underCase: appliedRate.chosen ∈ {short_term, heavy_progressive}');
  assert(hasFlag(rUnder, 'HEAVY_TAX_SHORT_TERM_COMPARISON'),
    'underCase: HEAVY_TAX_SHORT_TERM_COMPARISON 발동');

  // 9-A-1 (TC-011) HEAVY_TAX_SHORT_TERM_COMPARISON 미발동 (over2y)
  assert(!hasFlag(rTC011, 'HEAVY_TAX_SHORT_TERM_COMPARISON'),
    'TC-011 over2y → HEAVY_TAX_SHORT_TERM_COMPARISON 미발동');

  // ----------------------------------------------------------------
  // 그룹 v0.3-A_E. TC-011~014 골든셋 (4건, §10-3-5)
  // ----------------------------------------------------------------
  setGroup('그룹E v0.3-A TC-011~014');

  var GOLDEN_V03A = [
    { id: 'TC-011', count: 2, regulated: true,  expected: 286616000, isHeavy: true,  addition: 0.20  },
    { id: 'TC-012', count: 3, regulated: true,  expected: 339141000, isHeavy: true,  addition: 0.30  },
    { id: 'TC-013', count: 2, regulated: false, expected: 130878000, isHeavy: false, addition: null  },
    { id: 'TC-014', count: 3, regulated: false, expected: 130878000, isHeavy: false, addition: null  }
  ];

  GOLDEN_V03A.forEach(function (tc) {
    var r = taxEngine.calculateSingleTransfer(buildV03ACase(tc.count, tc.regulated));
    var s = r.steps;
    // 핵심 KPI: totalTax (4자 일치)
    assertEq(s.totalTax,            tc.expected, tc.id + ' totalTax === ' + tc.expected);
    assertEq(r.metrics.totalTax,    tc.expected, tc.id + ' metrics.totalTax === steps.totalTax');
    // 단계별 검증
    assertEq(s.transferGain,        480000000,   tc.id + ' transferGain');
    assertEq(s.is1Se1House,         false,       tc.id + ' is1Se1House (다주택)');
    assertEq(s.isHighValueHouse,    false,       tc.id + ' isHighValueHouse');
    assertEq(s.holdingYears,        12,          tc.id + ' holdingYears === 12');
    assertEq(s.holdingPeriodBranch, 'over2y',    tc.id + ' holdingPeriodBranch === "over2y"');
    assertEq(s.basicDeduction,      2500000,     tc.id + ' basicDeduction');
    assertEq(s.isHeavyTaxation,     tc.isHeavy,  tc.id + ' isHeavyTaxation');
    assertEq(s.heavyRateAddition,   tc.addition, tc.id + ' heavyRateAddition');
    assertEq(s.shortTermTax,        null,        tc.id + ' shortTermTax === null (over2y)');
    assertEq(s.heavyProgressiveTax, null,        tc.id + ' heavyProgressiveTax === null (over2y)');
    // 단계 4
    if (tc.isHeavy) {
      assertEq(s.longTermDeduction,    0,    tc.id + ' 중과 → longTermDeduction === 0');
      assertEq(s.appliedDeductionTable, null, tc.id + ' 중과 → appliedDeductionTable === null');
      assertEq(s.totalRate,            0,    tc.id + ' 중과 → totalRate === 0');
      assertEq(s.appliedRate.type, 'progressive_with_heavy',
        tc.id + ' 중과 → appliedRate.type === "progressive_with_heavy"');
    } else {
      // TC-013·014: v0.2 그대로 (TC-008 회귀, 표 1 + 보유 12년 → 0.24)
      assertEq(s.appliedDeductionTable, 1,    tc.id + ' 회귀 → appliedDeductionTable === 1');
      assertEq(s.totalRate,        0.24,     tc.id + ' 회귀 → totalRate === 0.24 (표 1, 12년)');
      assertEq(s.appliedRate.type, 'basic',  tc.id + ' 회귀 → appliedRate.type === "basic"');
    }
    // 단계 11
    assertEq(s.localIncomeTax, Math.floor(s.calculatedTax * 0.1),
      tc.id + ' localIncomeTax === floor(calculatedTax × 0.1)');
    // 단계 13
    assertEq(s.netAfterTaxSaleAmount, 1000000000 - tc.expected,
      tc.id + ' netAfterTaxSaleAmount === 10억 - totalTax');
  });

  // ----------------------------------------------------------------
  // 그룹 v0.3-A_F. issueFlag 25종 발동 검증 (§10-3-6)
  // ----------------------------------------------------------------
  setGroup('그룹F v0.3-A issueFlag');

  var rTC012 = taxEngine.calculateSingleTransfer(buildV03ACase(3, true));
  var rTC014 = taxEngine.calculateSingleTransfer(buildV03ACase(3, false));

  // v0.3-A 신규 5종
  assert( hasFlag(rTC011, 'HEAVY_TAXATION_APPLIED'),
    'TC-011 HEAVY_TAXATION_APPLIED 발동');
  assertEq(findFlag(rTC011, 'HEAVY_TAXATION_APPLIED').severity, 'warning',
    'HEAVY_TAXATION_APPLIED severity === "warning"');
  assert( hasFlag(rTC011, 'HEAVY_TAXATION_2_HOUSES'),
    'TC-011 HEAVY_TAXATION_2_HOUSES 발동');
  assert(!hasFlag(rTC011, 'HEAVY_TAXATION_3_HOUSES'),
    'TC-011 HEAVY_TAXATION_3_HOUSES 미발동 (2주택)');
  assert( hasFlag(rTC012, 'HEAVY_TAXATION_3_HOUSES'),
    'TC-012 HEAVY_TAXATION_3_HOUSES 발동');
  assert(!hasFlag(rTC012, 'HEAVY_TAXATION_2_HOUSES'),
    'TC-012 HEAVY_TAXATION_2_HOUSES 미발동 (3주택)');
  assert( hasFlag(rTC011, 'LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY'),
    'TC-011 LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY 발동 (보유 12년)');

  // v0.3-A 보조 3종
  assert( hasFlag(rTC011, 'SALE_REGULATED_USER_INPUT'),
    'TC-011 SALE_REGULATED_USER_INPUT 발동 (info, 항상)');
  assert( hasFlag(rTC013, 'SALE_REGULATED_USER_INPUT'),
    'TC-013 SALE_REGULATED_USER_INPUT 발동 (info, 항상)');
  assert( hasFlag(rTC011, 'HEAVY_TAX_EXCLUSION_NOT_HANDLED'),
    'TC-011 HEAVY_TAX_EXCLUSION_NOT_HANDLED 발동 (중과)');
  assert(!hasFlag(rTC013, 'HEAVY_TAX_EXCLUSION_NOT_HANDLED'),
    'TC-013 HEAVY_TAX_EXCLUSION_NOT_HANDLED 미발동 (중과 미발동)');
  assert(!hasFlag(rTC014, 'HEAVY_TAX_EXCLUSION_NOT_HANDLED'),
    'TC-014 HEAVY_TAX_EXCLUSION_NOT_HANDLED 미발동 (중과 미발동)');
  assert( hasFlag(rTC011, 'HEAVY_TAX_TRANSITION_NOT_HANDLED'),
    'TC-011 HEAVY_TAX_TRANSITION_NOT_HANDLED 발동 (중과)');

  // 폐기 1종 — 어떤 케이스에서도 미발동
  assert(!hasFlag(rTC011, 'OUT_OF_V01_SCOPE_REGULATED_AREA'),
    'TC-011 OUT_OF_V01_SCOPE_REGULATED_AREA 미발동 (폐기)');
  assert(!hasFlag(rTC013, 'OUT_OF_V01_SCOPE_REGULATED_AREA'),
    'TC-013 OUT_OF_V01_SCOPE_REGULATED_AREA 미발동 (폐기)');

  // ================================================================
  // 결과 출력
  // ================================================================

  console.log('==========================================');
  console.log('=== tax_engine v0.3-A 회귀 테스트 ===');
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
