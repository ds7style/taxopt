# 작업지시서 01 — tax_rules.js 작성

| 항목 | 내용 |
|---|---|
| 작업 ID | WO-01 |
| 작성일 | 2026-04-29 |
| 작성자 | 작업 창 #1-1 (코드/룰 작업 창) |
| 대상 도구 | Claude Code |
| 선행 작업 | 없음 (코드 첫 작업) |
| 후속 작업 | WO-02 (`tax_engine.js`), WO-03 (`tests/test_cases.js` 골든셋) |
| 예상 소요 | 30~45분 |

---

## 1. 작업 목표 (한 문장)

TaxOpt 계산 엔진 v0.1.1의 **세법 규칙 데이터 모듈** `js/tax_rules.js`와 그
**단독 회귀 테스트** `tests/tax_rules.test.js`를 작성한다. 이 모듈은
`tax_engine.js`가 사용할 상수·헬퍼·자체검증을 제공한다.

---

## 2. 수정·생성 대상 파일

| 종류 | 경로 | 비고 |
|---|---|---|
| 신규 | `js/tax_rules.js` | 본문 |
| 신규 | `tests/tax_rules.test.js` | 단독 회귀 테스트 |

기존 파일은 어떤 것도 수정하지 않는다.

---

## 3. 새로 만들 함수·객체·상수

`js/tax_rules.js`는 IIFE로 감싸 `window.TaxOpt.taxRules` 단일 객체를 노출한다.

### 3-1. 메타·상수

| 멤버 | 타입 | 값 |
|---|---|---|
| `RULE_VERSION` | string | `"v0.1.1-post-20260510"` |
| `APPLICABLE_SALE_DATE_FROM` | string (ISO date) | `"2026-05-10"` |
| `LAW_REFS` | object | 6개 키 (incomeTaxAct, incomeTaxEnforcement, progressiveRate, transferTaxRate, basicDeduction, localIncomeTax) |
| `BASIC_DEDUCTION_AMOUNT` | number (정수) | `2500000` |
| `LOCAL_INCOME_TAX_RATE` | number | `0.1` |
| `SHORT_TERM_RATE_UNDER_1Y` | number | `0.7` |
| `SHORT_TERM_RATE_UNDER_2Y` | number | `0.6` |
| `PROGRESSIVE_BRACKETS` | object[] (길이 8) | 명세서 §4-2 그대로 |

### 3-2. PROGRESSIVE_BRACKETS 각 원소 스키마

```js
{
  idx:          1~8,
  lowerBound:   number,    // 정수, 이전 구간 upperBound와 동일
  upperBound:   number,    // 정수 또는 Infinity (8구간)
  marginalRate: number,    // 0~1
  baseTax:      number,    // 정수, lowerBound까지 누적 산출세액
  label:        string     // UI 표시용
}
```

8개 원소의 정확한 값은 **명세서 §4-2 표에서 그대로** 옮긴다.
임의 추정 금지. 옮겨 적은 후 자체검증으로 검증한다 (§3-4).

### 3-3. 헬퍼

```js
findBracket(taxBase: number): bracket
```

`taxBase`가 속하는 구간 객체를 반환. 경계는 "이하" 기준
(예: 14,000,000 → 1구간, 14,000,001 → 2구간).
음수·비정수·NaN·Infinity·문자열·null·undefined → `Error` throw.

### 3-4. 자체검증 함수

| 함수 | 반환 | 검증 항목 |
|---|---|---|
| `verifyProgressiveContinuity()` | `{ok, checks[7]}` | 명세서 §4-3 누진 연속성 7개 경계 |
| `verifyBaseTaxAreIntegers()` | `{ok, fails[]}` | 8개 baseTax가 모두 `Number.isInteger` |
| `verifyMonotonic()` | `{ok, fails[]}` | lowerBound 연결, marginalRate·baseTax 엄격 증가 |
| `selfTest()` | `{ok, continuity, integers, monotonic}` | 위 3개 종합 |

자체검증은 **throw하지 않는다**. 결과 객체로만 반환.

---

## 4. 입력값

본 모듈은 외부 입력을 직접 받지 않는다 (데이터 모듈).
`findBracket`만 인자를 받는다.

| 함수 | 인자 | 타입·제약 | 예시 |
|---|---|---|---|
| `findBracket` | `taxBase` | number, ≥ 0, 정수 (Number.isInteger), 유한 | `287500000` (TC-001), `14000000` (TC-005) |

---

## 5. 출력값

### 5-1. `findBracket` 반환

`PROGRESSIVE_BRACKETS`의 한 원소 (참조). 호출 측이 변경하지 않는 것이 약속.

예시 (taxBase = 287,500,000, TC-001):
```js
{
  idx: 5,
  lowerBound: 150000000,
  upperBound: 300000000,
  marginalRate: 0.38,
  baseTax: 37060000,
  label: '기본세율 5구간 (1.5억 초과 3억 이하, 38% 누진)'
}
```

### 5-2. `selfTest` 반환

```js
{
  ok: true,
  continuity: { ok: true, checks: [ /* 7개 */ ] },
  integers:   { ok: true, fails: [] },
  monotonic:  { ok: true, fails: [] }
}
```

---

## 6. 예외처리 규칙

| 상황 | 처리 |
|---|---|
| `findBracket` 인자가 음수·비정수·비유한·비숫자 | `Error` throw, 메시지에 입력값 포함 |
| 자체검증 실패 | throw 안 함. `ok: false`로 반환 |
| `PROGRESSIVE_BRACKETS` 데이터 오타 | 자체검증에서 잡히도록 모든 정답값을 명시적으로 명세서에서 옮겨 적기 |
| `window`가 없는 환경 (Node) | `globalThis` 또는 `this`로 fallback |

---

## 7. 구현하지 말아야 할 것 (out of scope)

- ❌ 양도차익·과세표준 등 13단계 파이프라인 계산 (→ WO-02 `tax_engine.js`)
- ❌ 보유기간 분기 판정 (`under1y`/`under2y`/`over2y` 결정) — 날짜 비교는 입력 의존, `tax_engine.js`로
- ❌ `Math.floor` 절사 호출 — 산식 적용 이후 단계
- ❌ `caseData` 정규화·검증 (→ `input_collector.js`)
- ❌ 화면 DOM 접근 (`document.querySelector` 등 일체 금지)
- ❌ `console.log` 디버그 출력 (테스트 파일에서만 사용)
- ❌ ES6 module 문법 (`import`/`export`) — decision_log #5
- ❌ `Object.freeze` (v0.2 검토 사항)
- ❌ Camel/snake/kebab 혼용 — 파일명 snake_case 고정

---

## 8. 테스트 방법

### 8-1. 자동 테스트

`tests/tax_rules.test.js`를 다음 두 방법 중 하나로 실행:

**브라우저:**
```html
<script src="../js/tax_rules.js"></script>
<script src="./tax_rules.test.js"></script>
```
콘솔에서 `[FAIL] ...` 라인이 0개여야 통과.

**Node.js:**
```bash
node -e "global.window={};require('./js/tax_rules.js');require('./tests/tax_rules.test.js')"
```
종료 코드 0 = 통과, 1 = 실패.

### 8-2. 수동 검증 (선택)

브라우저 콘솔에서:
```js
TaxOpt.taxRules.selfTest().ok                       // → true
TaxOpt.taxRules.findBracket(287500000).idx          // → 5  (TC-001)
TaxOpt.taxRules.findBracket(14000000).idx           // → 1  (TC-005)
TaxOpt.taxRules.BASIC_DEDUCTION_AMOUNT              // → 2500000
TaxOpt.taxRules.RULE_VERSION                        // → "v0.1.1-post-20260510"
```

---

## 9. 완료 기준 (체크리스트)

- [ ] `js/tax_rules.js`가 IIFE로 감싸여 있고 `window.TaxOpt.taxRules`를 노출한다
- [ ] `PROGRESSIVE_BRACKETS`가 정확히 8개 원소이며, 각 원소가 명세서 §4-2 값과 1:1 일치한다
- [ ] `selfTest().ok === true`
- [ ] `verifyProgressiveContinuity()`가 7개 경계 모두 통과
- [ ] `findBracket(14000000).idx === 1` (TC-005 경계)
- [ ] `findBracket(287500000).idx === 5` (TC-001 회귀)
- [ ] `findBracket(-1)`, `findBracket(1.5)`, `findBracket(NaN)` 모두 throw
- [ ] `tests/tax_rules.test.js` 단독 실행 시 실패 0건
- [ ] DOM 접근 코드 없음 (`document`·`window.addEventListener` 등)
- [ ] `import`/`export` 문법 없음
- [ ] 모든 함수에 JSDoc 주석 (입력·출력·근거 조문)
- [ ] 파일 상단에 명세서·골든셋·decision_log 경로 기재

---

## 10. 참고 문서 경로

| 문서 | 경로 | 어떤 부분을 참조하는지 |
|---|---|---|
| 계산 엔진 명세서 v0.1.1 | `docs/v0.1/01_calc_engine_spec.md` | §1-3 적용 전제 / §4-1 단기세율 / §4-2 기본세율표 / §4-3 누진 연속성 / §5 절사 정책 |
| 입력 스키마 v0.1.1 | `docs/v0.1/03_input_schema.md` | §5 계산 함수 입력측 계약 (참고만 — 본 모듈은 입력 받지 않음) |
| 골든셋 v0.1 | `docs/v0.1/06_test_cases.md` | TC-001 (taxBase 287,500,000) / TC-005 (taxBase 14,000,000) — `findBracket` 회귀 보호 |
| 의사결정 로그 | `docs/99_decision_log.md` | #5 (snake_case·비-모듈) / #8 (v0.1.1 명세서 확정·디렉토리 구조) |
| 소득세법 | `docs/소득세법법률제21065호20260102_양도소득세만.pdf` | 제55조 ① (기본세율표) / 제103조 (기본공제) / 제104조 ① (단기세율) |

---

## 11. 작업 후 보고 양식

작업 완료 시 다음을 보고: