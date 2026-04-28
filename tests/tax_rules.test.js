/**
 * tests/tax_rules.test.js
 *
 * tax_rules.js 단독 회귀 테스트 (v0.1).
 *
 * 실행 방법:
 *   1) 브라우저:
 *      <script src="../js/tax_rules.js"></script>
 *      <script src="./tax_rules.test.js"></script>
 *      → 콘솔에서 결과 확인
 *
 *   2) Node.js:
 *      $ node -e "global.window={};require('./js/tax_rules.js');require('./tests/tax_rules.test.js')"
 *      또는 사전에 두 파일을 합쳐서 node 실행
 *
 * 검증 범위 (이 파일에서만):
 *   - 메타데이터 상수값
 *   - 누진 연속성 (명세서 §4-3, 7개 경계)
 *   - baseTax 정수성 (8개)
 *   - 단조성 (lowerBound 연결, marginalRate·baseTax 엄격 증가)
 *   - findBracket 경계값 (TC-001, TC-005 회귀 보호)
 *   - findBracket 예외 처리
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

  assertEq(rules.RULE_VERSION, 'v0.1.1-post-20260510', 'RULE_VERSION');
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