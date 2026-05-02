/**
 * tests/tax_rules.test.js
 *
 * tax_rules.js 단독 회귀 테스트 (v0.2).
 *
 * 실행 방법:
 *   1) 브라우저:
 *      <script src="../js/tax_rules.js"></script>
 *      <script src="./tax_rules.test.js"></script>
 *      → 콘솔에서 결과 확인
 *
 *   2) Node.js:
 *      $ node -e "global.window={};require('./js/tax_rules.js');require('./tests/tax_rules.test.js')"
 *
 * 검증 범위 (이 파일에서만):
 *   - 메타데이터 상수값 (v0.1 그대로 + RULE_VERSION 값만 v0.2 갱신)
 *   - 누진 연속성 (명세서 §4-3, 7개 경계)
 *   - baseTax 정수성 (8개)
 *   - 단조성 (lowerBound 연결, marginalRate·baseTax 엄격 증가)
 *   - findBracket 경계값 (TC-001, TC-005 회귀 보호)
 *   - findBracket 예외 처리
 *   - [v0.2 신규] 노출 멤버 존재성 (24종)
 *   - [v0.2 신규] 장특공 표 1·표 2 좌·표 2 우 룩업 sanity 15건 (TC-006~010 회귀)
 *   - [v0.2 신규] 클램프·단서 정책
 *   - [v0.2 신규] findHoldingRate·findResidenceRate 입력 검증 throw
 *   - [v0.2 신규] selfTest 결과 객체 (longTermLookups 필드)
 *   - [v0.2 신규] 룩업 테이블 자기 검증 (행 사이 공백·중복 없음, rate 단조 증가)
 *
 * 검증 범위 외 (tax_engine 단계에서):
 *   - 13단계 파이프라인 결과
 *   - 골든셋 TC-001~005 종합 결과
 */
(function (global) {
  'use strict';

  var rules = (global.TaxOpt && global.TaxOpt.taxRules) ||
              (typeof require !== 'undefined' ? null : null);

  if (!rules) {
    console.error('[FAIL] tax_rules.js가 로드되지 않았습니다. window.TaxOpt.taxRules 없음.');
    return;
  }

  var passed = 0;
  var failed = 0;
  var failures = [];

  function assert(cond, label) {
    if (cond) {
      passed++;
    } else {
      failed++;
      failures.push(label);
      console.error('[FAIL] ' + label);
    }
  }

  function assertEq(actual, expected, label) {
    var ok = actual === expected;
    if (ok) {
      passed++;
    } else {
      failed++;
      failures.push(label + ' (expected=' + expected + ', actual=' + actual + ')');
      console.error('[FAIL] ' + label + ' expected=' + expected + ' actual=' + actual);
    }
  }

  // ----------------------------------------------------------------
  // 그룹 1. 메타데이터·상수
  // ----------------------------------------------------------------

  // v0.3-A: RULE_VERSION 갱신. 작업지시서 05 §3-4 + 모듈 스펙 §3-6-1.
  assertEq(rules.RULE_VERSION, 'v0.3.0-post-20260510', 'RULE_VERSION');
  assertEq(rules.APPLICABLE_SALE_DATE_FROM, '2026-05-10', 'APPLICABLE_SALE_DATE_FROM');
  assertEq(rules.BASIC_DEDUCTION_AMOUNT, 2500000, 'BASIC_DEDUCTION_AMOUNT');
  assertEq(rules.LOCAL_INCOME_TAX_RATE, 0.1, 'LOCAL_INCOME_TAX_RATE');
  assertEq(rules.SHORT_TERM_RATE_UNDER_1Y, 0.7, 'SHORT_TERM_RATE_UNDER_1Y');
  assertEq(rules.SHORT_TERM_RATE_UNDER_2Y, 0.6, 'SHORT_TERM_RATE_UNDER_2Y');
  assertEq(rules.PROGRESSIVE_BRACKETS.length, 8, 'PROGRESSIVE_BRACKETS.length === 8');

  // ----------------------------------------------------------------
  // 그룹 2. 누진 연속성 (명세서 §4-3, 7개 경계)
  // ----------------------------------------------------------------

  var cont = rules.verifyProgressiveContinuity();
  assert(cont.ok, '누진 연속성 — 7개 경계 모두 일치');
  assertEq(cont.checks.length, 7, '누진 연속성 — 검증 항목 7개');

  // 명세서 §4-3 7개 경계 정답값을 직접 어서션 (방어적 회귀)
  var goldenContinuity = [
    { upper:    14000000, expected:       840000 },
    { upper:    50000000, expected:      6240000 },
    { upper:    88000000, expected:     15360000 },
    { upper:   150000000, expected:     37060000 },
    { upper:   300000000, expected:     94060000 },
    { upper:   500000000, expected:    174060000 },
    { upper:  1000000000, expected:    384060000 }
  ];
  for (var i = 0; i < goldenContinuity.length; i++) {
    var g = goldenContinuity[i];
    var c = cont.checks[i];
    assertEq(c.upperBound, g.upper,    '연속성 ['+(i+1)+'] upperBound');
    assertEq(c.expected,   g.expected, '연속성 ['+(i+1)+'] expected baseTax');
    assertEq(c.actual,     g.expected, '연속성 ['+(i+1)+'] 실제 산식값 일치');
    assert(c.ok, '연속성 ['+(i+1)+'] ok');
  }

  // ----------------------------------------------------------------
  // 그룹 3. baseTax 정수성 (8개)
  // ----------------------------------------------------------------

  var ints = rules.verifyBaseTaxAreIntegers();
  assert(ints.ok, 'baseTax 정수성 — 8개 모두 정수');
  assertEq(ints.fails.length, 0, 'baseTax 정수성 fails 0개');

  // ----------------------------------------------------------------
  // 그룹 4. 단조성
  // ----------------------------------------------------------------

  var mono = rules.verifyMonotonic();
  assert(mono.ok, '단조성 — lowerBound 연결, marginalRate·baseTax 엄격 증가');
  assertEq(mono.fails.length, 0, '단조성 fails 0개');

  // ----------------------------------------------------------------
  // 그룹 5. selfTest 종합
  // ----------------------------------------------------------------

  var st = rules.selfTest();
  assert(st.ok, 'selfTest 종합 ok');

  // ----------------------------------------------------------------
  // 그룹 6. findBracket 경계값
  // ----------------------------------------------------------------

  // 골든셋 TC-005: taxBase = 14,000,000 → 1구간 (경계 "이하")
  assertEq(rules.findBracket(14000000).idx, 1, 'findBracket(14,000,000) → 1구간 [TC-005 회귀]');
  // 1구간 끝 + 1원 → 2구간
  assertEq(rules.findBracket(14000001).idx, 2, 'findBracket(14,000,001) → 2구간');
  // 2구간 끝
  assertEq(rules.findBracket(50000000).idx, 2, 'findBracket(50,000,000) → 2구간');
  assertEq(rules.findBracket(50000001).idx, 3, 'findBracket(50,000,001) → 3구간');
  // 3구간 끝
  assertEq(rules.findBracket(88000000).idx, 3, 'findBracket(88,000,000) → 3구간');
  assertEq(rules.findBracket(88000001).idx, 4, 'findBracket(88,000,001) → 4구간');
  // 4구간 끝
  assertEq(rules.findBracket(150000000).idx, 4, 'findBracket(150,000,000) → 4구간');
  assertEq(rules.findBracket(150000001).idx, 5, 'findBracket(150,000,001) → 5구간');
  // 골든셋 TC-001: taxBase = 287,500,000 → 5구간
  assertEq(rules.findBracket(287500000).idx, 5, 'findBracket(287,500,000) → 5구간 [TC-001 회귀]');
  // 5구간 끝
  assertEq(rules.findBracket(300000000).idx, 5, 'findBracket(300,000,000) → 5구간');
  assertEq(rules.findBracket(300000001).idx, 6, 'findBracket(300,000,001) → 6구간');
  // 6구간 끝
  assertEq(rules.findBracket(500000000).idx, 6, 'findBracket(500,000,000) → 6구간');
  assertEq(rules.findBracket(500000001).idx, 7, 'findBracket(500,000,001) → 7구간');
  // 7구간 끝
  assertEq(rules.findBracket(1000000000).idx, 7, 'findBracket(1,000,000,000) → 7구간');
  assertEq(rules.findBracket(1000000001).idx, 8, 'findBracket(1,000,000,001) → 8구간');
  // 0
  assertEq(rules.findBracket(0).idx, 1, 'findBracket(0) → 1구간 (taxBase=0 양도차손 처리)');
  // 매우 큰 수
  assertEq(rules.findBracket(99999999999).idx, 8, 'findBracket(99,999,999,999) → 8구간');

  // ----------------------------------------------------------------
  // 그룹 7. findBracket 예외 처리
  // ----------------------------------------------------------------

  function expectThrow(fn, label) {
    var threw = false;
    try { fn(); } catch (e) { threw = true; }
    assert(threw, label);
  }

  expectThrow(function () { rules.findBracket(-1); },        'findBracket(-1) throw');
  expectThrow(function () { rules.findBracket(1.5); },       'findBracket(1.5) throw (비정수)');
  expectThrow(function () { rules.findBracket(NaN); },       'findBracket(NaN) throw');
  expectThrow(function () { rules.findBracket(Infinity); },  'findBracket(Infinity) throw');
  expectThrow(function () { rules.findBracket('100'); },     'findBracket("100") throw (문자열)');
  expectThrow(function () { rules.findBracket(null); },      'findBracket(null) throw');
  expectThrow(function () { rules.findBracket(undefined); }, 'findBracket(undefined) throw');

  // ----------------------------------------------------------------
  // 그룹 8. 입력 불변성 (findBracket이 brackets를 변경하지 않음)
  // ----------------------------------------------------------------

  var beforeIdx5BaseTax = rules.PROGRESSIVE_BRACKETS[4].baseTax;
  rules.findBracket(287500000); // TC-001 케이스
  assertEq(rules.PROGRESSIVE_BRACKETS[4].baseTax, beforeIdx5BaseTax,
    'findBracket 호출 후 PROGRESSIVE_BRACKETS 불변');

  // ================================================================
  // v0.2 신규 회귀 테스트 (작업지시서 03 §10-2 그룹 A~F)
  // ================================================================

  var TABLE_1            = rules.LONG_TERM_DEDUCTION_TABLE_1;
  var TABLE_2_HOLDING    = rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING;
  var TABLE_2_RESIDENCE  = rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE;

  // ----------------------------------------------------------------
  // 그룹 A. v0.2 노출 멤버 존재성 (10건)
  // ----------------------------------------------------------------

  assert(Array.isArray(TABLE_1) && TABLE_1.length === 13,
    'LONG_TERM_DEDUCTION_TABLE_1 정의되어 있고 길이 13');
  assert(Array.isArray(TABLE_2_HOLDING) && TABLE_2_HOLDING.length === 8,
    'LONG_TERM_DEDUCTION_TABLE_2_HOLDING 정의되어 있고 길이 8');
  assert(Array.isArray(TABLE_2_RESIDENCE) && TABLE_2_RESIDENCE.length === 9,
    'LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE 정의되어 있고 길이 9');
  assertEq(TABLE_2_RESIDENCE[0].requiresHoldingMin3y, true,
    'LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE idx=1 행 requiresHoldingMin3y === true');
  assertEq(rules.HIGH_VALUE_HOUSE_THRESHOLD, 1200000000,
    'HIGH_VALUE_HOUSE_THRESHOLD === 1200000000');
  assertEq(rules.NON_TAXABLE_HOLDING_MIN_YEARS, 2,
    'NON_TAXABLE_HOLDING_MIN_YEARS === 2');
  assertEq(rules.NON_TAXABLE_RESIDENCE_MIN_YEARS, 2,
    'NON_TAXABLE_RESIDENCE_MIN_YEARS === 2');
  assert(Array.isArray(rules.HOLDING_PERIOD_BOUNDARY_YEARS) &&
         rules.HOLDING_PERIOD_BOUNDARY_YEARS.length === 4 &&
         rules.HOLDING_PERIOD_BOUNDARY_YEARS[0] === 1 &&
         rules.HOLDING_PERIOD_BOUNDARY_YEARS[1] === 2 &&
         rules.HOLDING_PERIOD_BOUNDARY_YEARS[2] === 3 &&
         rules.HOLDING_PERIOD_BOUNDARY_YEARS[3] === 15,
    'HOLDING_PERIOD_BOUNDARY_YEARS deep equal [1, 2, 3, 15]');
  assertEq(typeof rules.findHoldingRate, 'function',
    'typeof findHoldingRate === "function"');
  assertEq(typeof rules.findResidenceRate, 'function',
    'typeof findResidenceRate === "function"');

  // 부수 — UNREGISTERED_RATE (모듈 스펙 §3-6-3, §11-5)
  assertEq(rules.UNREGISTERED_RATE, 0.7, 'UNREGISTERED_RATE === 0.7');
  // 부수 — verifyLongTermLookups 함수 노출
  assertEq(typeof rules.verifyLongTermLookups, 'function',
    'typeof verifyLongTermLookups === "function"');
  // 부수 — LAW_REFS v0.2 신규 4키 존재
  assertEq(typeof rules.LAW_REFS.nonTaxation1Se1House, 'string',
    'LAW_REFS.nonTaxation1Se1House (v0.2 신규) 존재');
  assertEq(typeof rules.LAW_REFS.highValueHouse, 'string',
    'LAW_REFS.highValueHouse (v0.2 신규) 존재');
  assertEq(typeof rules.LAW_REFS.longTermDeductionTable1, 'string',
    'LAW_REFS.longTermDeductionTable1 (v0.2 신규) 존재');
  assertEq(typeof rules.LAW_REFS.longTermDeductionTable2, 'string',
    'LAW_REFS.longTermDeductionTable2 (v0.2 신규) 존재');
  // v0.1 LAW_REFS 6키 그대로 잔존
  assertEq(rules.LAW_REFS.progressiveRate, '소득세법 제55조 제1항',
    'LAW_REFS.progressiveRate (v0.1) 그대로');
  assertEq(rules.LAW_REFS.localIncomeTax, '지방세법 제103조의3',
    'LAW_REFS.localIncomeTax (v0.1) 그대로');

  // ----------------------------------------------------------------
  // 그룹 B. sanity 15건 (장특공 룩업, TC-006~010 회귀 보호)
  //   표 1: 5건 / 표 2 좌측: 3건 / 표 2 우측: 7건
  //   모듈 스펙 §4-2-3 + §4-3-3
  // ----------------------------------------------------------------

  // 표 1 (5건)
  assertEq(rules.findHoldingRate(2,  TABLE_1), 0,    'findHoldingRate(2, T1) === 0 (보유 < 3년)');
  assertEq(rules.findHoldingRate(3,  TABLE_1), 0.06, 'findHoldingRate(3, T1) === 0.06 (idx=1 시작)');
  assertEq(rules.findHoldingRate(5,  TABLE_1), 0.10, 'findHoldingRate(5, T1) === 0.10 [TC-010 회귀]');
  assertEq(rules.findHoldingRate(12, TABLE_1), 0.24, 'findHoldingRate(12, T1) === 0.24 [TC-008 회귀]');
  assertEq(rules.findHoldingRate(20, TABLE_1), 0.30, 'findHoldingRate(20, T1) === 0.30 (15년+ 클램프)');

  // 표 2 좌측 (3건)
  assertEq(rules.findHoldingRate(8,  TABLE_2_HOLDING), 0.32, 'findHoldingRate(8, T2_H) === 0.32 [TC-007 회귀]');
  assertEq(rules.findHoldingRate(10, TABLE_2_HOLDING), 0.40, 'findHoldingRate(10, T2_H) === 0.40 [TC-009 클램프]');
  assertEq(rules.findHoldingRate(50, TABLE_2_HOLDING), 0.40, 'findHoldingRate(50, T2_H) === 0.40 (클램프)');

  // 표 2 우측 (7건)
  assertEq(rules.findResidenceRate(0,  8,  TABLE_2_RESIDENCE), 0,
    'findResidenceRate(0, 8, T2_R) === 0 (거주 < 2년)');
  assertEq(rules.findResidenceRate(2,  2,  TABLE_2_RESIDENCE), 0,
    'findResidenceRate(2, 2, T2_R) === 0 (보유 < 3년 단서 차단)');
  assertEq(rules.findResidenceRate(2,  5,  TABLE_2_RESIDENCE), 0.08,
    'findResidenceRate(2, 5, T2_R) === 0.08 (단서 행 활성)');
  assertEq(rules.findResidenceRate(5,  5,  TABLE_2_RESIDENCE), 0.20,
    'findResidenceRate(5, 5, T2_R) === 0.20');
  assertEq(rules.findResidenceRate(8,  8,  TABLE_2_RESIDENCE), 0.32,
    'findResidenceRate(8, 8, T2_R) === 0.32 [TC-007 회귀]');
  assertEq(rules.findResidenceRate(10, 10, TABLE_2_RESIDENCE), 0.40,
    'findResidenceRate(10, 10, T2_R) === 0.40 [TC-009 클램프]');
  assertEq(rules.findResidenceRate(50, 50, TABLE_2_RESIDENCE), 0.40,
    'findResidenceRate(50, 50, T2_R) === 0.40 (클램프)');

  // ----------------------------------------------------------------
  // 그룹 C. 클램프·단서 정책 추가 회귀
  // ----------------------------------------------------------------

  assertEq(rules.findHoldingRate(0,   TABLE_1),         0,    'findHoldingRate(0, T1) === 0');
  assertEq(rules.findHoldingRate(15,  TABLE_1),         0.30, 'findHoldingRate(15, T1) === 0.30 (idx=13 시작 = 클램프)');
  assertEq(rules.findHoldingRate(0,   TABLE_2_HOLDING), 0,    'findHoldingRate(0, T2_H) === 0');
  assertEq(rules.findHoldingRate(3,   TABLE_2_HOLDING), 0.12, 'findHoldingRate(3, T2_H) === 0.12 (idx=1 시작)');
  assertEq(rules.findResidenceRate(3, 3, TABLE_2_RESIDENCE), 0.12,
    'findResidenceRate(3, 3, T2_R) === 0.12 (idx=2)');
  assertEq(rules.findResidenceRate(2, 3, TABLE_2_RESIDENCE), 0.08,
    'findResidenceRate(2, 3, T2_R) === 0.08 (단서 행, 보유 정확히 3년)');

  // ----------------------------------------------------------------
  // 그룹 D. 입력 검증 throw 케이스
  // ----------------------------------------------------------------

  // findHoldingRate
  expectThrow(function () { rules.findHoldingRate(-1, TABLE_1); },        'findHoldingRate(-1, T1) throw');
  expectThrow(function () { rules.findHoldingRate(5.5, TABLE_1); },       'findHoldingRate(5.5, T1) throw (비정수)');
  expectThrow(function () { rules.findHoldingRate(NaN, TABLE_1); },       'findHoldingRate(NaN, T1) throw');
  expectThrow(function () { rules.findHoldingRate(Infinity, TABLE_1); },  'findHoldingRate(Infinity, T1) throw');
  expectThrow(function () { rules.findHoldingRate('5', TABLE_1); },       'findHoldingRate("5", T1) throw (문자열)');
  expectThrow(function () { rules.findHoldingRate(null, TABLE_1); },      'findHoldingRate(null, T1) throw');
  expectThrow(function () { rules.findHoldingRate(undefined, TABLE_1); },'findHoldingRate(undefined, T1) throw');
  expectThrow(function () { rules.findHoldingRate(5, []); },              'findHoldingRate(5, []) throw');
  expectThrow(function () { rules.findHoldingRate(5, null); },            'findHoldingRate(5, null) throw');
  expectThrow(function () { rules.findHoldingRate(5, 'not array'); },     'findHoldingRate(5, "not array") throw');

  // findResidenceRate
  expectThrow(function () { rules.findResidenceRate(-1, 5, TABLE_2_RESIDENCE); },
    'findResidenceRate(-1, 5, T2_R) throw');
  expectThrow(function () { rules.findResidenceRate(5, -1, TABLE_2_RESIDENCE); },
    'findResidenceRate(5, -1, T2_R) throw');
  expectThrow(function () { rules.findResidenceRate(5.5, 5, TABLE_2_RESIDENCE); },
    'findResidenceRate(5.5, 5, T2_R) throw (비정수)');
  expectThrow(function () { rules.findResidenceRate(5, 5.5, TABLE_2_RESIDENCE); },
    'findResidenceRate(5, 5.5, T2_R) throw (비정수)');
  expectThrow(function () { rules.findResidenceRate(NaN, 5, TABLE_2_RESIDENCE); },
    'findResidenceRate(NaN, 5, T2_R) throw');
  expectThrow(function () { rules.findResidenceRate(Infinity, 5, TABLE_2_RESIDENCE); },
    'findResidenceRate(Infinity, 5, T2_R) throw');
  expectThrow(function () { rules.findResidenceRate('5', 5, TABLE_2_RESIDENCE); },
    'findResidenceRate("5", 5, T2_R) throw (문자열)');
  expectThrow(function () { rules.findResidenceRate(null, 5, TABLE_2_RESIDENCE); },
    'findResidenceRate(null, 5, T2_R) throw');
  expectThrow(function () { rules.findResidenceRate(undefined, 5, TABLE_2_RESIDENCE); },
    'findResidenceRate(undefined, 5, T2_R) throw');
  expectThrow(function () { rules.findResidenceRate(5, 5, []); },
    'findResidenceRate(5, 5, []) throw');
  expectThrow(function () { rules.findResidenceRate(5, 5, null); },
    'findResidenceRate(5, 5, null) throw');

  // ----------------------------------------------------------------
  // 그룹 E. selfTest 결과 객체 (v0.2 longTermLookups 보강)
  // ----------------------------------------------------------------

  var st2 = rules.selfTest();
  assert(st2.ok, 'selfTest().ok === true (v0.2 4종 모두 통과)');
  assert(typeof st2.longTermLookups === 'object' && st2.longTermLookups !== null,
    'selfTest().longTermLookups 객체로 정의됨');
  assertEq(st2.longTermLookups.ok, true, 'selfTest().longTermLookups.ok === true');
  assertEq(st2.longTermLookups.table1Fails.length, 0,
    'selfTest().longTermLookups.table1Fails.length === 0');
  assertEq(st2.longTermLookups.table2HoldingFails.length, 0,
    'selfTest().longTermLookups.table2HoldingFails.length === 0');
  assertEq(st2.longTermLookups.table2ResidenceFails.length, 0,
    'selfTest().longTermLookups.table2ResidenceFails.length === 0');
  assertEq(st2.continuity.ok, true, 'selfTest().continuity.ok === true (v0.1 회귀)');
  assertEq(st2.integers.ok,   true, 'selfTest().integers.ok === true (v0.1 회귀)');
  assertEq(st2.monotonic.ok,  true, 'selfTest().monotonic.ok === true (v0.1 회귀)');

  // ----------------------------------------------------------------
  // 그룹 F. 룩업 테이블 자기 검증 (행 사이 공백·중복 없음, rate 단조 증가)
  // ----------------------------------------------------------------

  // TABLE_1: 13행 정의·필드·연결성·단조성·idx=13 Infinity
  var t1_ok_def = true, t1_ok_link = true, t1_ok_mono = true;
  for (var i1 = 0; i1 < TABLE_1.length; i1++) {
    var r1 = TABLE_1[i1];
    if (typeof r1.lowerBound !== 'number' ||
        typeof r1.upperBound !== 'number' ||
        typeof r1.rate !== 'number') {
      t1_ok_def = false;
    }
    if (i1 > 0 && r1.lowerBound !== TABLE_1[i1 - 1].upperBound) {
      t1_ok_link = false;
    }
    if (i1 > 0 && !(r1.rate > TABLE_1[i1 - 1].rate)) {
      t1_ok_mono = false;
    }
  }
  assert(t1_ok_def,  'TABLE_1: 13행 모두 lowerBound·upperBound·rate 정의됨');
  assert(t1_ok_link, 'TABLE_1: 행 사이 lowerBound[i] === upperBound[i-1]');
  assert(t1_ok_mono, 'TABLE_1: rate 엄격 단조 증가 (0.06 < 0.08 < ... < 0.30)');
  assertEq(TABLE_1[12].upperBound, Infinity, 'TABLE_1: idx=13 upperBound === Infinity');
  assertEq(TABLE_1[12].rate, 0.30, 'TABLE_1: idx=13 rate === 0.30');

  // TABLE_2_HOLDING: 8행 동일 검증
  var t2h_ok_link = true, t2h_ok_mono = true;
  for (var i2 = 0; i2 < TABLE_2_HOLDING.length; i2++) {
    var r2 = TABLE_2_HOLDING[i2];
    if (i2 > 0 && r2.lowerBound !== TABLE_2_HOLDING[i2 - 1].upperBound) {
      t2h_ok_link = false;
    }
    if (i2 > 0 && !(r2.rate > TABLE_2_HOLDING[i2 - 1].rate)) {
      t2h_ok_mono = false;
    }
  }
  assert(t2h_ok_link, 'TABLE_2_HOLDING: 행 사이 lowerBound[i] === upperBound[i-1]');
  assert(t2h_ok_mono, 'TABLE_2_HOLDING: rate 엄격 단조 증가');
  assertEq(TABLE_2_HOLDING[7].upperBound, Infinity, 'TABLE_2_HOLDING: idx=8 upperBound === Infinity');
  assertEq(TABLE_2_HOLDING[7].rate, 0.40, 'TABLE_2_HOLDING: idx=8 rate === 0.40');

  // TABLE_2_RESIDENCE: 9행 동일 검증 + 9행 모두 requiresHoldingMin3y === true
  var t2r_ok_link = true, t2r_ok_mono = true, t2r_ok_meta = true;
  for (var i3 = 0; i3 < TABLE_2_RESIDENCE.length; i3++) {
    var r3 = TABLE_2_RESIDENCE[i3];
    if (i3 > 0 && r3.lowerBound !== TABLE_2_RESIDENCE[i3 - 1].upperBound) {
      t2r_ok_link = false;
    }
    if (i3 > 0 && !(r3.rate > TABLE_2_RESIDENCE[i3 - 1].rate)) {
      t2r_ok_mono = false;
    }
    if (r3.requiresHoldingMin3y !== true) {
      t2r_ok_meta = false;
    }
  }
  assert(t2r_ok_link, 'TABLE_2_RESIDENCE: 행 사이 lowerBound[i] === upperBound[i-1]');
  assert(t2r_ok_mono, 'TABLE_2_RESIDENCE: rate 엄격 단조 증가');
  assert(t2r_ok_meta, 'TABLE_2_RESIDENCE: 9행 모두 requiresHoldingMin3y === true');
  assertEq(TABLE_2_RESIDENCE[8].upperBound, Infinity, 'TABLE_2_RESIDENCE: idx=9 upperBound === Infinity');
  assertEq(TABLE_2_RESIDENCE[8].rate, 0.40, 'TABLE_2_RESIDENCE: idx=9 rate === 0.40');

  // ================================================================
  // v0.3-A 신규 회귀 테스트 (작업지시서 05 §9-2 그룹 A~D)
  // ================================================================

  var HEAVY = rules.HEAVY_TAX_RATE_ADDITION;

  // ----------------------------------------------------------------
  // v0.3-A 그룹 A. HEAVY_TAX_RATE_ADDITION 룩업 검증 (§9-2-1)
  // ----------------------------------------------------------------

  assert(Array.isArray(HEAVY) && HEAVY.length === 2,
    'HEAVY_TAX_RATE_ADDITION 배열이고 length === 2');
  assertEq(HEAVY[0].houseCount, 2, 'HEAVY[0].houseCount === 2');
  assertEq(HEAVY[0].addition,   0.20, 'HEAVY[0].addition === 0.20');
  assertEq(HEAVY[1].houseCount, 3, 'HEAVY[1].houseCount === 3');
  assertEq(HEAVY[1].addition,   0.30, 'HEAVY[1].addition === 0.30');
  assertEq(HEAVY[0].lawRefKey, 'heavyTaxation', 'HEAVY[0].lawRefKey === "heavyTaxation"');
  assertEq(HEAVY[1].lawRefKey, 'heavyTaxation', 'HEAVY[1].lawRefKey === "heavyTaxation"');
  assertEq(typeof HEAVY[0].label, 'string', 'HEAVY[0].label string');
  assertEq(typeof HEAVY[1].label, 'string', 'HEAVY[1].label string');
  assertEq(typeof rules.LAW_REFS.heavyTaxation, 'string',
    'LAW_REFS.heavyTaxation 존재 (string)');
  assert(rules.LAW_REFS.heavyTaxation.length > 0,
    'LAW_REFS.heavyTaxation 비어있지 않음');

  // ----------------------------------------------------------------
  // v0.3-A 그룹 B. findHeavyTaxRateAddition 클램프·throw 검증 (§9-2-2)
  // ----------------------------------------------------------------

  assertEq(typeof rules.findHeavyTaxRateAddition, 'function',
    'typeof findHeavyTaxRateAddition === "function"');

  // 클램프 (4건)
  assertEq(rules.findHeavyTaxRateAddition(2),  0.20, 'findHeavyTaxRateAddition(2) === 0.20');
  assertEq(rules.findHeavyTaxRateAddition(3),  0.30, 'findHeavyTaxRateAddition(3) === 0.30');
  assertEq(rules.findHeavyTaxRateAddition(4),  0.30, 'findHeavyTaxRateAddition(4) === 0.30 (4주택 클램프)');
  assertEq(rules.findHeavyTaxRateAddition(10), 0.30, 'findHeavyTaxRateAddition(10) === 0.30 (10주택 클램프)');

  // throw (9건)
  expectThrow(function () { rules.findHeavyTaxRateAddition(1); },
    'findHeavyTaxRateAddition(1) throw');
  expectThrow(function () { rules.findHeavyTaxRateAddition(0); },
    'findHeavyTaxRateAddition(0) throw');
  expectThrow(function () { rules.findHeavyTaxRateAddition(-1); },
    'findHeavyTaxRateAddition(-1) throw');
  expectThrow(function () { rules.findHeavyTaxRateAddition(2.5); },
    'findHeavyTaxRateAddition(2.5) throw (비정수)');
  expectThrow(function () { rules.findHeavyTaxRateAddition(NaN); },
    'findHeavyTaxRateAddition(NaN) throw');
  expectThrow(function () { rules.findHeavyTaxRateAddition(Infinity); },
    'findHeavyTaxRateAddition(Infinity) throw');
  expectThrow(function () { rules.findHeavyTaxRateAddition('2'); },
    'findHeavyTaxRateAddition("2") throw (문자열)');
  expectThrow(function () { rules.findHeavyTaxRateAddition(null); },
    'findHeavyTaxRateAddition(null) throw');
  expectThrow(function () { rules.findHeavyTaxRateAddition(undefined); },
    'findHeavyTaxRateAddition(undefined) throw');

  // ----------------------------------------------------------------
  // v0.3-A 그룹 C. selfTest 보강 검증 (§9-2-3)
  // ----------------------------------------------------------------

  var st3 = rules.selfTest();
  assertEq(st3.ok, true, 'selfTest().ok === true (v0.2 4종 + v0.3-A 1종 = 5종 모두 통과)');
  assert(typeof st3.heavyTaxAdditionLookups === 'object' && st3.heavyTaxAdditionLookups !== null,
    'selfTest().heavyTaxAdditionLookups 객체로 정의됨');
  assertEq(st3.heavyTaxAdditionLookups.ok, true,
    'selfTest().heavyTaxAdditionLookups.ok === true');
  assertEq(st3.heavyTaxAdditionLookups.sanityResults.length, 4,
    'selfTest().heavyTaxAdditionLookups.sanityResults.length === 4');
  assertEq(st3.heavyTaxAdditionLookups.throwResults.length, 4,
    'selfTest().heavyTaxAdditionLookups.throwResults.length === 4');

  // ----------------------------------------------------------------
  // v0.3-A 그룹 D. v0.2 노출 멤버 24종 회귀 (append-only 보장, §9-2-4)
  // ----------------------------------------------------------------

  // v0.2 24종 멤버 모두 그대로 접근 가능 (선택적 점검)
  assertEq(typeof rules.findBracket, 'function',         '[D] findBracket 보존');
  assertEq(typeof rules.findHoldingRate, 'function',     '[D] findHoldingRate 보존');
  assertEq(typeof rules.findResidenceRate, 'function',   '[D] findResidenceRate 보존');
  assert(Array.isArray(rules.PROGRESSIVE_BRACKETS) && rules.PROGRESSIVE_BRACKETS.length === 8,
    '[D] PROGRESSIVE_BRACKETS 보존');
  assert(Array.isArray(rules.LONG_TERM_DEDUCTION_TABLE_1) && rules.LONG_TERM_DEDUCTION_TABLE_1.length === 13,
    '[D] LONG_TERM_DEDUCTION_TABLE_1 보존');
  assert(Array.isArray(rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING) && rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING.length === 8,
    '[D] LONG_TERM_DEDUCTION_TABLE_2_HOLDING 보존');
  assert(Array.isArray(rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE) && rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE.length === 9,
    '[D] LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE 보존');
  assertEq(rules.HIGH_VALUE_HOUSE_THRESHOLD, 1200000000, '[D] HIGH_VALUE_HOUSE_THRESHOLD 보존');
  assertEq(rules.NON_TAXABLE_HOLDING_MIN_YEARS, 2, '[D] NON_TAXABLE_HOLDING_MIN_YEARS 보존');
  assertEq(rules.NON_TAXABLE_RESIDENCE_MIN_YEARS, 2, '[D] NON_TAXABLE_RESIDENCE_MIN_YEARS 보존');
  // v0.2 selfTest 6종 검증 항목 모두 ok === true
  assertEq(st3.continuity.ok,        true, '[D] selfTest().continuity.ok === true (v0.1)');
  assertEq(st3.integers.ok,          true, '[D] selfTest().integers.ok === true (v0.1)');
  assertEq(st3.monotonic.ok,         true, '[D] selfTest().monotonic.ok === true (v0.1)');
  assertEq(st3.longTermLookups.ok,   true, '[D] selfTest().longTermLookups.ok === true (v0.2)');

  // ----------------------------------------------------------------
  // 결과 출력
  // ----------------------------------------------------------------

  console.log('==========================================');
  console.log('tax_rules.js 단독 회귀 테스트 결과');
  console.log('  통과: ' + passed);
  console.log('  실패: ' + failed);
  if (failed > 0) {
    console.log('  실패 항목:');
    for (var j = 0; j < failures.length; j++) {
      console.log('    - ' + failures[j]);
    }
  }
  console.log('==========================================');

  // 환경별 결과 노출
  if (typeof global.TaxOpt !== 'undefined') {
    global.TaxOpt._taxRulesTestResult = { passed: passed, failed: failed, failures: failures };
  }
  if (failed > 0 && typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }

})(typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : this));