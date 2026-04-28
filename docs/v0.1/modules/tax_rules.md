# tax_rules.js 모듈 스펙 v0.1.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.1/tax_rules.md` |
| 버전 | v0.1.1 |
| 상태 | 작성 완료 (2026-04-28) |
| 작성 출처 | 작업 창 #1-1 (코드/룰 작업 창) |
| 대상 코드 | `js/tax_rules.js` |
| 대상 테스트 | `tests/tax_rules.test.js` |
| 관련 작업지시서 | `docs/05_code_work_orders/01_tax_rules.md` |
| 관련 명세서 | `docs/v0.1/01_calc_engine_spec.md` (§1-3, §4-1, §4-2, §4-3, §5) |
| 관련 골든셋 | `docs/v0.1/06_test_cases.md` (TC-001, TC-005) |
| 관련 의사결정 | `docs/99_decision_log.md` #5, #8 |
| 다음 버전 | v0.2 (장특공·비과세 도입 시 갱신) |

---

## 0. 문서 위치·역할

본 문서는 `js/tax_rules.js`의 **계약 문서**입니다. 호출하는 측(`tax_engine.js` 등)이 이 모듈을 어떻게 사용해야 하는지, 이 모듈이 무엇을 보장하는지를 정의합니다.

코드 본문(`js/tax_rules.js`)과 본 문서가 충돌하면 **본 문서를 우선**합니다. 코드 본문이 본 문서와 다르면 코드를 수정합니다. 본 문서를 변경해야 하는 경우는 v0.1 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신합니다.

---

## 1. 노출 객체

```js
window.TaxOpt.taxRules
```

ES6 module(`import`/`export`)을 사용하지 않습니다(decision_log #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화합니다.

`window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback합니다.

---

## 2. 노출 멤버 (전체)

| 멤버 | 타입 | 역할 | 근거 |
|---|---|---|---|
| `RULE_VERSION` | string | 결과 객체에 기록할 규칙 버전 식별자 | decision_log #8 |
| `APPLICABLE_SALE_DATE_FROM` | string (ISO date) | 본 규칙이 적용되는 양도일 하한 | 명세서 §1-3 |
| `LAW_REFS` | object | 적용 법령 라벨 6개 | — |
| `BASIC_DEDUCTION_AMOUNT` | number (정수) | 양도소득 기본공제액 2,500,000 | 소득세법 제103조 |
| `LOCAL_INCOME_TAX_RATE` | number | 지방소득세율 0.1 | 지방세법 제103조의3 |
| `SHORT_TERM_RATE_UNDER_1Y` | number | 1년 미만 단기세율 0.7 | 제104조 ① 제3호 |
| `SHORT_TERM_RATE_UNDER_2Y` | number | 1~2년 미만 단기세율 0.6 | 제104조 ① 제2호 |
| `PROGRESSIVE_BRACKETS` | object[] (길이 8) | 누진세율표 | 제55조 ① |
| `findBracket(taxBase)` | function | 과세표준 → 구간 객체 | — |
| `selfTest()` | function | 종합 자체검증 | 명세서 §4-3 |
| `verifyProgressiveContinuity()` | function | 누진 연속성 검증 | 명세서 §4-3 |
| `verifyBaseTaxAreIntegers()` | function | baseTax 정수성 검증 | v0.1 검증 원칙 6 |
| `verifyMonotonic()` | function | 단조성 검증 | — |

---

## 3. 상수 상세

### 3-1. 메타데이터

| 멤버 | 값 | 비고 |
|---|---|---|
| `RULE_VERSION` | `"v0.1.1-post-20260510"` | `taxResult.ruleVersion`에 그대로 기록 |
| `APPLICABLE_SALE_DATE_FROM` | `"2026-05-10"` | 양도일이 이 날짜 이전이면 호출 측이 `OUT_OF_V01_SCOPE_DATE` issueFlag 발동 |
| `LAW_REFS.incomeTaxAct` | `"소득세법 [법률 제21065호, 2026-01-02 시행]"` | — |
| `LAW_REFS.incomeTaxEnforcement` | `"소득세법 시행령 [대통령령 제36129호, 2026-03-01 시행]"` | — |
| `LAW_REFS.progressiveRate` | `"소득세법 제55조 제1항"` | 기본세율표 근거 |
| `LAW_REFS.transferTaxRate` | `"소득세법 제104조 제1항"` | 단기세율 근거 |
| `LAW_REFS.basicDeduction` | `"소득세법 제103조"` | 기본공제 근거 |
| `LAW_REFS.localIncomeTax` | `"지방세법 제103조의3"` | 지방소득세 근거 |

### 3-2. 금액·세율 상수

| 멤버 | 값 | 단위 | 근거 |
|---|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | `2500000` | 원 (정수) | 소득세법 제103조 |
| `LOCAL_INCOME_TAX_RATE` | `0.1` | 비율 | 지방세법 제103조의3 |
| `SHORT_TERM_RATE_UNDER_1Y` | `0.7` | 비율 | 소득세법 제104조 ① 제3호 (주택) |
| `SHORT_TERM_RATE_UNDER_2Y` | `0.6` | 비율 | 소득세법 제104조 ① 제2호 (주택) |

---

## 4. PROGRESSIVE_BRACKETS

### 4-1. 원소 스키마

```js
{
  idx:          number,    // 1~8
  lowerBound:   number,    // 정수, 이전 구간 upperBound와 동일
  upperBound:   number,    // 정수 또는 Infinity (8구간만)
  marginalRate: number,    // 0~1
  baseTax:      number,    // 정수, lowerBound까지 누적 산출세액
  label:        string     // UI 표시용
}
```

### 4-2. 8개 원소 정답값 (명세서 §4-2)

| idx | lowerBound | upperBound | marginalRate | baseTax |
|---|---|---|---|---|
| 1 | 0 | 14,000,000 | 0.06 | 0 |
| 2 | 14,000,000 | 50,000,000 | 0.15 | 840,000 |
| 3 | 50,000,000 | 88,000,000 | 0.24 | 6,240,000 |
| 4 | 88,000,000 | 150,000,000 | 0.35 | 15,360,000 |
| 5 | 150,000,000 | 300,000,000 | 0.38 | 37,060,000 |
| 6 | 300,000,000 | 500,000,000 | 0.40 | 94,060,000 |
| 7 | 500,000,000 | 1,000,000,000 | 0.42 | 174,060,000 |
| 8 | 1,000,000,000 | Infinity | 0.45 | 384,060,000 |

### 4-3. 누진 연속성 보장

각 구간 i에 대해 (i = 0..6, 즉 1~7구간): brackets[i].baseTax + (brackets[i].upperBound − brackets[i].lowerBound) × brackets[i].marginalRate
=== brackets[i+1].baseTax

8구간은 `upperBound = Infinity`이므로 검증 대상 외.

이 7개 등식은 `verifyProgressiveContinuity()`로 자체검증되며, 모든 등식의 양변이 정수입니다.

---

## 5. findBracket(taxBase) 계약

| 항목 | 내용 |
|---|---|
| 입력 | `taxBase: number` (원 단위 정수, ≥ 0, 유한) |
| 출력 | `PROGRESSIVE_BRACKETS`의 한 원소 (참조 반환) |
| 경계 처리 | 상한 "이하" 기준. `14,000,000` → 1구간, `14,000,001` → 2구간 |
| 예외 | 음수·비정수·NaN·Infinity·문자열·null·undefined → `Error` throw |
| 부수효과 | 없음 (순수 함수) |
| 입력 변경 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |

### 5-1. 경계 케이스 표

| 입력 | 반환 idx | 비고 |
|---|---|---|
| `0` | 1 | 양도차손 시 taxBase=0 처리 |
| `14000000` | 1 | TC-005 회귀 보호 |
| `14000001` | 2 | 1→2 경계 |
| `50000000` | 2 | 2 구간 끝 |
| `50000001` | 3 | 2→3 경계 |
| `88000000` | 3 | 3 구간 끝 |
| `88000001` | 4 | 3→4 경계 |
| `150000000` | 4 | 4 구간 끝 |
| `150000001` | 5 | 4→5 경계 |
| `287500000` | 5 | TC-001 회귀 보호 |
| `300000000` | 5 | 5 구간 끝 |
| `300000001` | 6 | 5→6 경계 |
| `500000000` | 6 | 6 구간 끝 |
| `500000001` | 7 | 6→7 경계 |
| `1000000000` | 7 | 7 구간 끝 |
| `1000000001` | 8 | 7→8 경계 |
| `99999999999` | 8 | 매우 큰 수 |

### 5-2. 예외 케이스 표

| 입력 | 결과 |
|---|---|
| `-1` | throw |
| `1.5` | throw (비정수) |
| `NaN` | throw |
| `Infinity` | throw |
| `"100"` | throw (문자열) |
| `null` | throw |
| `undefined` | throw |

---

## 6. 자체검증 함수 계약

### 6-1. `selfTest()`

| 항목 | 내용 |
|---|---|
| 입력 | 없음 |
| 출력 | `{ ok: boolean, continuity: object, integers: object, monotonic: object }` |
| 부수효과 | 없음. 실패해도 throw하지 않음 |
| 호출 권장 시점 | 페이지 부트스트랩 1회. `ok === false`이면 호출 측이 결과 산출을 차단 |

성공 시 출력 예시:
```js
{
  ok: true,
  continuity: { ok: true, checks: [/* 7개 */] },
  integers:   { ok: true, fails: [] },
  monotonic:  { ok: true, fails: [] }
}
```

### 6-2. `verifyProgressiveContinuity()`

| 항목 | 내용 |
|---|---|
| 출력 | `{ ok: boolean, checks: Array<{idx, upperBound, expected, actual, ok}> }` |
| `checks.length` | 7 (1~7구간만) |
| 검증 내용 | 각 i에 대해 `bracket[i].baseTax + (upperBound − lowerBound) × marginalRate === bracket[i+1].baseTax` 그리고 양변이 정수 |

### 6-3. `verifyBaseTaxAreIntegers()`

| 항목 | 내용 |
|---|---|
| 출력 | `{ ok: boolean, fails: Array<{idx, value}> }` |
| 검증 내용 | 8개 모든 `baseTax`가 `Number.isInteger` |
| 의의 | v0.1 검증 원칙 6번 (모든 금액 변수가 정수) 보장 |

### 6-4. `verifyMonotonic()`

| 항목 | 내용 |
|---|---|
| 출력 | `{ ok: boolean, fails: Array<object> }` |
| 검증 내용 | (1) `lowerBound[i] === upperBound[i-1]`, (2) `marginalRate` 엄격 증가, (3) `baseTax` 엄격 증가 |

---

## 7. 불변성 약속

- 호출자는 `window.TaxOpt.taxRules`가 노출하는 객체를 변경하지 않습니다.
- 본 모듈은 `Object.freeze`를 적용하지 않습니다(v0.1). v0.2에서 `PROGRESSIVE_BRACKETS`·`LAW_REFS` freeze를 검토합니다.
- `findBracket`은 호출 시 `PROGRESSIVE_BRACKETS`를 변경하지 않습니다(검증 항목에 포함).

---

## 8. 의존성

| 의존 | 종류 |
|---|---|
| 외부 라이브러리 | 없음 |
| 다른 TaxOpt 모듈 | 없음 (베이스 모듈) |
| DOM | 사용 없음 |
| 전역 부수효과 | `window.TaxOpt.taxRules` 등록만 |

---

## 9. 비책임 (out of scope)

본 모듈은 다음을 **수행하지 않습니다**. 모두 다른 모듈의 책임입니다.

| 항목 | 담당 모듈 |
|---|---|
| `transferGain`, `taxBase` 등 13단계 파이프라인 계산 | `tax_engine.js` (WO-02) |
| 보유기간 분기 판정 (`under1y`/`under2y`/`over2y`) | `tax_engine.js` (날짜 비교는 입력 의존) |
| `Math.floor` 절사 호출 | `tax_engine.js` (산식 적용 후 단계) |
| `caseData` 정규화·검증 | `input_collector.js` (WO-04) |
| 화면 DOM 접근 | 본 모듈에서 일체 금지 |
| 결과 화면 렌더링 | `result_renderer.js` |
| 사용자 친화적 설명 문장 생성 | `explanation_engine.js` |

---

## 10. 호출 측 사용 예시 (참고)

`tax_engine.js`가 본 모듈을 어떻게 사용하게 될지 예시(WO-02에서 확정):

```js
// tax_engine.js 내부
var rules = window.TaxOpt.taxRules;

// 부트스트랩 시점 1회
var st = rules.selfTest();
if (!st.ok) {
  throw new Error('tax_rules selfTest failed: ' + JSON.stringify(st));
}

// 13단계 중 6단계 — 기본공제
var basicDeduction = caseData.basicDeductionUsed
  ? 0
  : rules.BASIC_DEDUCTION_AMOUNT;

// 13단계 중 9~10단계 — 적용 세율 + 산출세액
var bracket = rules.findBracket(taxBase);
var calculatedTax = Math.floor(
  bracket.baseTax + (taxBase - bracket.lowerBound) * bracket.marginalRate
);

// 13단계 중 11단계 — 지방소득세
var localIncomeTax = Math.floor(calculatedTax * rules.LOCAL_INCOME_TAX_RATE);
```

> 위는 의사 예시이며, 실제 13단계 결합은 WO-02 의사코드와 작업지시서에서 확정합니다.

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.1 | 2026-04-28 | 초기 작성. v0.1.1 명세서 기준 |

본 문서는 v0.1 명세서가 변경되지 않는 한 함께 변경되지 않습니다. v0.2에서 장특공·비과세가 추가되면 별도로 `docs/v0.2/tax_rules.md`를 작성하거나, 본 문서를 v0.2로 갱신합니다.