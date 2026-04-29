# Code 작업지시서 02 — tax_engine.js + 회귀 테스트

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/05_code_work_orders/02_tax_engine.md` |
| 버전 | v1.0 |
| 작성일 | 2026-04-29 |
| 작성 출처 | 작업 창 #4 (작업지시서 02 전용) |
| 작업 대상 | Claude Code |
| 선행 작업 | 작업지시서 01 (tax_rules.js) — ✅ 완료 (Node.js 67/0 통과, 사후 인정 확정) |
| 후속 작업 | 작업지시서 03 (input_collector.js) — 예정 |
| 의사결정 준수 | #5 (snake_case + 비-모듈), #8 (v0.1.1 기준), **#9 v9 (작업 창은 .js 본문 산출 금지)** |
| 백로그 반영 | B-003 (script 태그 추가 검증), **B-008 (effectiveTaxRate 사전 노출)** |

---

## 0. 작업 목표

`docs/v0.1/01_calc_engine_spec.md` v0.1.1 명세서의 13단계 파이프라인을 코드로 구현한다. 검증된 골든셋(TC-001~005)이 회귀 테스트로 모두 통과해야 한다.

본 작업의 성공 기준은 **3자 일치 검증된 골든셋(TC-001~005)이 회귀 테스트에서 100% 통과**하는 것이다. 산식은 명세서가 정본이며, 본 작업지시서는 명세서를 코드로 옮기는 절차서다.

### 0-1. 산출 파일

| 파일 | 역할 | Claude Code 단일 책임 |
|---|---|---|
| `js/tax_engine.js` | 13단계 파이프라인 본문 | ✅ |
| `tests/tax_engine.test.js` | TC-001~005 + 단계별 회귀 테스트 | ✅ |
| `index.html` 수정 | `<script src="js/tax_engine.js">` 추가 | ✅ |
| `docs/05_code_work_orders/02_tax_engine.md` | 본 작업지시서 (이미 존재) | (작업 창 #4 산출) |

### 0-2. 산출 금지 사항 (의사결정 #9 v9)

- 작업 창 #4는 본 작업지시서와 모듈 스펙 외에 .js 본문을 산출하지 않는다.
- Claude Code는 본 작업지시서를 단독 자료로 삼아 .js를 작성한다.
- 본 작업지시서의 의사코드는 **참고 골격(reference skeleton)** 수준이며, 그대로 복사·붙여넣기로 끝나지 않는다. Claude Code가 명세서·모듈 스펙·골든셋을 함께 참조하여 완성한다.

---

## 1. 선행 자료 (Claude Code가 먼저 읽어야 하는 문서)

다음 6개 문서를 본 작업지시서와 함께 읽는다. 충돌 시 우선순위는 위→아래 순.

| 우선순위 | 문서 | 역할 |
|---|---|---|
| 1 | `docs/v0.1/01_calc_engine_spec.md` v0.1.1 | **산식 정본 (검증 완료)** |
| 2 | `docs/v0.1/modules/tax_engine.md` v0.1.1 | 본 모듈의 계약 문서 |
| 3 | `docs/v0.1/modules/tax_rules.md` v0.1.1 | 의존 모듈 계약 |
| 4 | `docs/v0.1/03_input_schema.md` v0.1.1 | caseData 입력 스키마 |
| 5 | `docs/v0.1/06_test_cases.md` v0.1.1 | TC-001~005 정답 |
| 6 | 본 작업지시서 | 작업 절차 |

> 명세서 v0.1.1은 이미 검증팀 손계산·홈택스 모의계산과 3자 일치로 확정되었다. 산식 의문이 생기면 명세서를 **그대로** 따른다. 임의 해석·추정 금지.

---

## 2. 수정·생성 대상 파일

### 2-1. 신규 생성

| 파일 | 위치 | 비고 |
|---|---|---|
| `js/tax_engine.js` | repo root | 13단계 파이프라인 본문 |
| `tests/tax_engine.test.js` | repo root | 회귀 테스트 (Node.js 실행) |

### 2-2. 수정

| 파일 | 수정 내용 |
|---|---|
| `index.html` | `<script src="js/tax_rules.js"></script>` 다음 줄에 `<script src="js/tax_engine.js"></script>` 추가 |

> B-003 재발 방지: 새 모듈을 push할 때 반드시 HTML의 `<script>` 태그를 함께 추가한다. 외부 `<script>`는 인라인 `<script>` 이전에 배치한다.

### 2-3. 변경 금지

- `js/tax_rules.js` (사후 인정 확정, 변경 시 의사결정 필요)
- `tests/tax_rules.test.js` (사후 인정 확정)
- `docs/v0.1/01_calc_engine_spec.md` (검증 완료, 수정은 v0.2 명세서로)
- `docs/v0.1/06_test_cases.md` (골든셋, 수정은 새 케이스 추가만)

---

## 3. 13단계 파이프라인 함수 설계

각 단계는 모듈 스펙 §5와 동일하다. 본 절은 **Claude Code 구현 관점**에서 입출력·산식·예외처리·issueFlag 트리거를 정리한다.

### 3-0. 0단계 — `validateCaseData(caseData)`

| 항목 | 내용 |
|---|---|
| 입력 | `caseData` 전체 |
| 출력 | `{ ok: boolean, errors: string[], warnings: string[] }` |
| 호출 측 처리 | `ok === false` 시 `calculateSingleTransfer`는 `Error` throw |

검증 항목 (명세서 §8 표 그대로):

```
1. salePrice           : Number.isInteger && >= 1            → 실패: 에러
2. acquisitionPrice    : Number.isInteger && >= 1            → 실패: 에러
3. necessaryExpense    : Number.isInteger && >= 0            → 실패: 에러
4. acquisitionDate     : "YYYY-MM-DD" 패턴 유효              → 실패: 에러
5. saleDate            : "YYYY-MM-DD" 패턴 유효              → 실패: 에러
6. acquisitionDate < saleDate                                → 실패: 에러
7. saleDate.year === baseYear                                → 불일치: 경고
8. saleDate >= APPLICABLE_SALE_DATE_FROM ("2026-05-10")     → 미달: 경고
9. !acquisitionRegulated && !saleRegulated                   → 위반: 경고
```

> 양도차손(`transferGain < 0`)은 1단계 산출 후에만 가능하므로 0단계에서는 검증하지 않는다. 1단계 결과를 받아 `collectIssueFlags`에서 처리한다.

#### 참고 골격 (의사코드)

```
function validateCaseData(caseData) {
  var errors = [], warnings = [];
  var house = pickHouseFromCaseData(caseData);  // houseId 또는 candidateHouseIds[0]

  if (!Number.isInteger(house.expectedSalePrice) || house.expectedSalePrice < 1)
    errors.push('salePrice는 1 이상의 정수여야 합니다.');
  // ... 나머지 검증 ...

  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}
```

> 위 골격은 참고용. 정확한 구현은 Claude Code가 명세서 §8을 보고 결정.

### 3-1. 1단계 — `computeTransferGain(input)`

```
산식: salePrice − acquisitionPrice − necessaryExpense
출력: 정수 (음수 가능, 양도차손)
절사: 없음
```

### 3-2. 2단계 — `applyNonTaxation(transferGain, caseData)` (v0.1 passthrough)

```
산식: taxableGain = transferGain  (변경 없음)
v0.2 확장점: 1세대1주택 비과세 판정 후 비과세분 차감
```

함수 시그니처를 v0.2와 동일하게 유지하기 위해 함수로 분리. v0.1은 그대로 반환만.

### 3-3. 3단계 — `applyHighValueAllocation(taxableGain, caseData)` (v0.1 passthrough)

```
산식: taxableGain (변경 없음)
v0.2 확장점: 12억 초과분 안분
```

### 3-4. 4단계 — `computeLongTermDeduction(taxableGain, caseData)`

```
산식: 0  (v0.1 무조건 0)
v0.2 확장점: 보유기간·거주기간 기반 공제율
```

### 3-5. 5단계 — `computeCapitalGainIncome(taxableGain, longTermDeduction)`

```
산식: taxableGain − longTermDeduction
```

### 3-6. 6단계 — `computeBasicDeduction(basicDeductionUsed)`

```
산식: basicDeductionUsed ? 0 : tax_rules.BASIC_DEDUCTION_AMOUNT
주의: 상수 하드코딩 금지. tax_rules에서 가져올 것.
```

### 3-7. 7단계 — `computeTaxBase(capitalGainIncome, basicDeduction)`

```
산식: Math.max(0, capitalGainIncome − basicDeduction)
주의: 양도차손이면 자동 0 (TC-003 회귀)
```

### 3-8. 8단계 — `determineHoldingPeriodBranch(acquisitionDate, saleDate)`

가장 함정이 많은 단계. **JS Date 산술을 사용하지 말 것.** 동월동일 비교는 연/월/일 정수로 분해하여 비교한다.

#### 산식 (명세서 §3-1)

```
oneYearMark = (acqYear+1, acqMonth, acqDay)
twoYearMark = (acqYear+2, acqMonth, acqDay)

if (saleDate < oneYearMark) → "under1y"
else if (saleDate < twoYearMark) → "under2y"
else → "over2y"
```

#### 비교 방식

문자열 비교가 가장 단순하다 (`"2026-08-31" < "2027-01-15"`는 정확히 동작). 단, 마크 문자열은 다음과 같이 구성:

```
oneYearMark = (acqYear + 1) + "-" + pad2(acqMonth) + "-" + pad2(acqDay)
twoYearMark = (acqYear + 2) + "-" + pad2(acqMonth) + "-" + pad2(acqDay)
```

#### 윤년 처리 함정 (필독)

`acquisitionDate = "2024-02-29"`인 경우 `oneYearMark = "2025-02-29"`은 존재하지 않는 날짜. v0.1 골든셋에는 이런 케이스가 없으므로 v0.1 구현에서는 **그대로 문자열 비교를 허용**한다(존재하지 않는 날짜라도 정렬상 합당한 위치). 단, 코드 주석에 다음을 명시:

```js
// 주의: acquisitionDate가 2/29인 경우 oneYearMark="YYYY-02-29"가 존재하지 않는 날짜가 됨.
// v0.1 골든셋에는 해당 케이스가 없어 문자열 비교로 처리하나, v0.2에서 명시적 윤년 처리를 검토.
// 백로그 등록 권장: B-009 (윤년 경계 처리).
```

#### 경계 케이스 (명세서 §3-2)

- `saleDate === oneYearMark` → "under1y"가 **아니다** (즉 ≥ 1년이므로 under2y 또는 over2y 진입)
- `saleDate === twoYearMark` → "under2y"가 **아니다** (즉 ≥ 2년이므로 over2y 진입)
- 위 두 마크의 ±3일 이내인 경우 `HOLDING_PERIOD_BOUNDARY` issueFlag (warning) 발동 — `collectIssueFlags`에서 처리

> "±3일 이내" 판정은 ISO 날짜 문자열에서 정확히 구현하기 까다롭다. v0.1 단순 구현으로는 "saleDate가 (oneYearMark-3일, oneYearMark+3일) 또는 (twoYearMark-3일, twoYearMark+3일) 범위" 여부를 `Date` 객체의 차이값으로 산출 가능. 이 한 곳에서만 `Date`를 사용하되, 동월동일 분기 판정 자체에는 `Date`를 쓰지 않는다.

### 3-9. 9단계 — `determineAppliedRate(branch, taxBase)`

입력 `branch`는 8단계의 `"under1y" | "under2y" | "over2y"`. 출력은 모듈 스펙 §4-3의 `appliedRate` 객체 (`type`, `bracket`, `label`, `marginalRate`, `baseTax`, `lowerBound`).

분기별 반환 의도는 §3-9 위쪽 본 절에 이미 정리되어 있으므로 본문은 의사코드 골격만 둔다.

```
function determineAppliedRate(branch, taxBase) {
  // 보유기간 분기:
  //   "under1y" → 단기세율 70% (tax_rules.SHORT_TERM_RATE_UNDER_1Y), bracket=null
  //   "under2y" → 단기세율 60% (tax_rules.SHORT_TERM_RATE_UNDER_2Y), bracket=null
  //   "over2y"  → tax_rules.findBracket(taxBase) 결과 사용 (basic)
  // 반환: { type, bracket, label, marginalRate, baseTax, lowerBound }
  //   - 단기는 bracket=null, baseTax=0, lowerBound=0
  //   - basic은 findBracket 결과를 그대로 매핑 (idx → bracket)
}
```

> `lowerBound`를 출력 객체에 포함시키면 10단계가 다시 `findBracket`을 호출할 필요가 없다. 작업지시서 권장 구현.

### 3-10. 10단계 — `computeCalculatedTax(taxBase, appliedRate)`

```
if (appliedRate.type === "short70")
  return Math.floor(taxBase * appliedRate.marginalRate);   // 0.7
if (appliedRate.type === "short60")
  return Math.floor(taxBase * appliedRate.marginalRate);   // 0.6
// basic
return Math.floor(
  appliedRate.baseTax +
  (taxBase - appliedRate.lowerBound) * appliedRate.marginalRate
);
```

**핵심**: `Math.floor` 절사 필수. 절사하지 않으면 TC-005에서 0.0 같은 부동소수점 잡음이 잡힐 수 있다(거의 발생하지 않으나 보호 차원).

### 3-11. 11단계 — `computeLocalIncomeTax(calculatedTax)`

```
return Math.floor(calculatedTax * tax_rules.LOCAL_INCOME_TAX_RATE);
```

> `LOCAL_INCOME_TAX_RATE = 0.1`. JS의 `× 0.1`은 IEEE 754에서 부동소수점 오차가 발생할 수 있으므로 `Math.floor` 절사가 반드시 필요하다. TC-001: `89,310,000 × 0.1 = 8,931,000` 정수로 떨어지지만 절사는 **항상** 적용.

### 3-12. 12단계 — `computeTotalTax(calculatedTax, localIncomeTax)`

```
return calculatedTax + localIncomeTax;
```

정수 + 정수 = 정수.

### 3-13. 13단계 — `computeNetAfterTaxSaleAmount(salePrice, totalTax)`

```
return salePrice - totalTax;
```

정수 - 정수 = 정수.

### 3-14. 보강 단계 — `computeEffectiveTaxRate(totalTax, salePrice)` (B-008)

```
return salePrice === 0 ? null : totalTax / salePrice;
```

비율이므로 절사하지 않는다. JS Number 그대로.

### 3-15. 메인 — `calculateSingleTransfer(caseData, houseId?)`

부트스트랩 가드(`window.TaxOpt.taxRules` 미로드 시 throw)는 §3-0·§8-2에 명세. 입력 정규화(House → 단축형 input)는 모듈 스펙 §3-2 참조. 본 절은 13단계 호출 순서와 데이터 흐름만 의사코드로 표시한다.

```
function calculateSingleTransfer(caseData, houseId) {
  //  0. validateCaseData + 입력 정규화 (House → 단축형 input, 모듈 스펙 §3-2)
  //  1. transferGain = salePrice - acquisitionPrice - necessaryExpense
  //  2~3. v0.1 passthrough (비과세·고가주택 미적용)
  //  4~5. longTermDeduction = 0 → capitalGainIncome = taxableGain - longTermDeduction
  //  6. basicDeduction = basicDeductionUsed ? 0 : tax_rules.BASIC_DEDUCTION_AMOUNT
  //  7. taxBase = Math.max(0, capitalGainIncome - basicDeduction)
  //  8. holdingPeriodBranch ← 동월동일 비교 (under1y/under2y/over2y)
  //  9. appliedRate ← determineAppliedRate(branch, taxBase)
  // 10. calculatedTax = Math.floor(산식 적용)
  // 11. localIncomeTax = Math.floor(calculatedTax × tax_rules.LOCAL_INCOME_TAX_RATE)
  // 12. totalTax = calculatedTax + localIncomeTax
  // 13. netAfterTaxSaleAmount = salePrice - totalTax
  //     보강: effectiveTaxRate (B-008) + collectIssueFlags (10종 발동 판정)
  // 반환: taxResult (모듈 스펙 §4 스키마)
}
```

> 위 골격은 **단계 매김과 데이터 흐름만** 표시한다. 변수명, 호출 순서 미세 조정, 중간값 보관 방식, 결과 객체 조립 형태는 모두 Claude Code가 자체 결정한다.

---

## 4. tax_rules.js 의존 사용법

### 4-1. 부트스트랩 (selfTest)

```js
// tax_engine.selfTest() 내부에서
var rulesSt = window.TaxOpt.taxRules.selfTest();
if (!rulesSt.ok) {
  return { ok: false, taxRulesSelfTest: rulesSt, sanityChecks: null };
}
```

### 4-2. 사용 멤버 (모듈 스펙 §8-1)

| 사용 멤버 | 사용 단계 |
|---|---|
| `tax_rules.selfTest()` | tax_engine.selfTest() 부트스트랩 |
| `tax_rules.BASIC_DEDUCTION_AMOUNT` (=2,500,000) | 6단계 |
| `tax_rules.LOCAL_INCOME_TAX_RATE` (=0.1) | 11단계 |
| `tax_rules.SHORT_TERM_RATE_UNDER_1Y` (=0.7) | 9·10단계 (under1y) |
| `tax_rules.SHORT_TERM_RATE_UNDER_2Y` (=0.6) | 9·10단계 (under2y) |
| `tax_rules.findBracket(taxBase)` | 9·10단계 (over2y) |
| `tax_rules.RULE_VERSION` | 결과 객체 ruleVersion |
| `tax_rules.APPLICABLE_SALE_DATE_FROM` (="2026-05-10") | 0단계 검증 |
| `tax_rules.LAW_REFS` | 결과 객체 lawRefs |

### 4-3. 금지 사항

- 위 상수를 **하드코딩하지 말 것**. 항상 `tax_rules`에서 가져온다.
- `tax_rules`의 출력 객체를 **변경하지 말 것** (불변성 약속).
- `tax_rules`가 노출하지 않는 멤버에 접근하지 말 것.

---

## 5. issueFlag 발동 조건 (10종, 명세서 §7 + OUT_OF_V01_SCOPE_DATE)

`collectIssueFlags(caseData, intermediates)` 단일 함수에서 모두 결정.

| code | 발동 조건 | severity | lawRef |
|---|---|---|---|
| `LONG_TERM_DEDUCTION_NOT_APPLIED` | 보유기간 ≥ 3년 (acquisitionDate + 3년 ≤ saleDate, 동월동일 비교) | info | 소득세법 제95조 ② |
| `POSSIBLE_NON_TAXATION_1H1H` | 보유 ≥ 2년 + residenceMonths ≥ 24 + candidateHouseCount === 1 | info | 소득세법 제89조 |
| `HIGH_VALUE_HOUSE` | salePrice ≥ 1,200,000,000 | info | 소득세법 제95조 ③ |
| `OUT_OF_V01_SCOPE_REGULATED_AREA` | acquisitionRegulated === true OR saleRegulated === true | warning | 소득세법 제104조 ⑦ |
| `OUT_OF_V01_SCOPE_DATE` | saleDate < APPLICABLE_SALE_DATE_FROM ("2026-05-10") | warning | (v0.1 가정) |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | 항상 (단일 필드 입력) | info | 소득세법 제97조 |
| `UNREGISTERED_ASSET_ASSUMED_FALSE` | 항상 (가정) | info | 소득세법 제104조 ① 제10호 |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | 항상 (가정) | info | 소득세법 제97조 ① |
| `HOLDING_PERIOD_BOUNDARY` | saleDate가 oneYearMark 또는 twoYearMark의 ±3일 이내 | warning | 소득세법 제95조 ④ |
| `TRANSFER_LOSS_DETECTED` | transferGain < 0 | info | (v0.1 처리) |

### 5-1. 발동 결정 시점

`collectIssueFlags`는 13단계 모두 종료 후 한 번 호출된다. 각 issueFlag는 다음 입력으로 판정:

```
collectIssueFlags(caseData, {
  transferGain,            // TRANSFER_LOSS_DETECTED, LONG_TERM_DEDUCTION_NOT_APPLIED
  holdingPeriodBranch,     // (직접 사용 안 함, 보유연수는 별도 계산)
  appliedRate,             // (HOLDING_PERIOD_BOUNDARY 판정 보조)
  acquisitionDate,
  saleDate,
  salePrice,
  acquisitionRegulated,
  saleRegulated,
  residenceMonths,
  candidateHouseCount
});
```

### 5-2. message 작성 원칙

각 issueFlag의 `message`는 사용자가 읽을 수 있는 한 문장. 예시:

| code | message 예시 |
|---|---|
| `LONG_TERM_DEDUCTION_NOT_APPLIED` | "보유기간이 3년 이상입니다. v0.1은 장기보유특별공제 미적용. v0.2에서 정확한 세액 산출 예정." |
| `HIGH_VALUE_HOUSE` | "양도가액이 12억원 이상입니다. v0.1은 고가주택 12억 초과분 과세 미적용. v0.2에서 정확한 세액 산출 예정." |
| `TRANSFER_LOSS_DETECTED` | "양도가액이 취득가액과 필요경비 합계보다 작습니다. 양도차손이 발생했으며, 과세표준은 0원으로 처리됩니다." |

> 위는 예시. 정확한 문구는 Claude Code가 명세서·시스템 프롬프트의 "사용자 친화적 문장 생성" 원칙에 맞게 결정.

---

## 6. tests/tax_engine.test.js 작성 의도

### 6-1. 실행 환경

- Node.js 단독 실행 (`node tests/tax_engine.test.js`)
- 외부 라이브러리 의존 없음 (Jest, Mocha 등 사용 안 함)
- `console.assert` 또는 자체 assert 헬퍼 + 종합 보고 출력
- 마지막에 "X건 통과 / Y건 실패" 출력 (`tax_rules.test.js` 패턴 따름)

### 6-2. tax_rules.js 로드 방식

`tax_engine.js`는 `window.TaxOpt.taxRules`를 의존하므로 Node.js 환경에서 다음 부트스트랩 필요:

```js
// tests/tax_engine.test.js 상단
require('../js/tax_rules.js');   // window.TaxOpt.taxRules 등록
require('../js/tax_engine.js');  // window.TaxOpt.taxEngine 등록

var taxEngine = (typeof window !== 'undefined' ? window : globalThis).TaxOpt.taxEngine;
```

> `tax_rules.js`가 `globalThis` fallback을 사용하므로 Node.js에서도 등록된다. `tax_engine.js`도 동일 패턴 따를 것.

### 6-3. 테스트 그룹 (7개 describe)

#### 그룹 1 — selfTest 부트스트랩 검증

```
test('tax_engine.selfTest()는 ok: true를 반환한다');
test('selfTest 결과에 tax_rules selfTest가 포함된다');
test('selfTest sanityChecks가 TC-001/003/005를 포함한다');
```

#### 그룹 2 — validateCaseData 입력 검증

```
test('정상 caseData는 ok: true를 반환한다');
test('salePrice = 0은 에러');
test('salePrice = -1은 에러');
test('salePrice = 1.5는 에러 (비정수)');
test('acquisitionPrice = 0은 에러');
test('necessaryExpense = -1은 에러');
test('acquisitionDate >= saleDate는 에러');
test('saleDate < "2026-05-10"은 경고 + OUT_OF_V01_SCOPE_DATE issueFlag');
test('acquisitionRegulated === true는 경고 + OUT_OF_V01_SCOPE_REGULATED_AREA issueFlag');
```

#### 그룹 3 — 13단계 파이프라인, TC-001~005 골든셋 (핵심)

```
test('TC-001: 정상 일반과세 (보유 6년 7개월) — totalTax=98,241,000');
test('TC-002: 단기세율 60% (보유 1년 7개월) — totalTax=61,050,000');
test('TC-003: 양도차손 — totalTax=0');
test('TC-004: 기본공제 사용 — totalTax=99,286,000');
test('TC-005: 누진 1구간 경계값 — totalTax=924,000');
```

각 TC에서 다음 13개 항목을 모두 비교:

```
- transferGain
- capitalGainIncome
- basicDeduction
- taxBase
- holdingPeriodBranch
- appliedRate.type (또는 bracket idx)
- calculatedTax
- localIncomeTax
- totalTax
- netAfterTaxSaleAmount
+ metrics.totalTax === steps.totalTax
+ metrics.netAfterTaxSaleAmount === steps.netAfterTaxSaleAmount
+ metrics.effectiveTaxRate === totalTax / salePrice
```

> 정답값은 `docs/v0.1/06_test_cases.md` §2~§6에서 그대로 가져온다. 코드 상수로 묻어두지 말고 별도 데이터 객체(`TC_GOLDEN_V01`)로 분리.

#### 그룹 4 — 단계별 함수 단위 테스트 (회귀 보호)

각 단계별 순수 함수가 명세서 산식과 일치하는지 단위로 검증.

```
describe('1단계 computeTransferGain', () => {
  test('800M − 500M − 10M = 290M');
  test('480M − 500M − 10M = -30M (음수 가능)');
});

describe('6단계 computeBasicDeduction', () => {
  test('basicDeductionUsed=false → 2,500,000');
  test('basicDeductionUsed=true → 0');
});

describe('7단계 computeTaxBase', () => {
  test('양수 입력 → 정상 차감');
  test('음수 capitalGainIncome → 0 (TC-003 회귀)');
});

describe('8단계 determineHoldingPeriodBranch', () => {
  test('"2025-01-15" → "2026-01-15" (정확히 1년) → "under2y" (under1y 아님)');
  test('"2025-01-15" → "2026-01-14" (1년 미만) → "under1y"');
  test('"2024-01-15" → "2026-01-15" (정확히 2년) → "over2y" (under2y 아님)');
  test('"2024-01-15" → "2026-01-14" (2년 미만) → "under2y"');
  test('"2018-03-01" → "2026-07-15" (TC-005, 8년 4개월) → "over2y"');
});

describe('9단계 determineAppliedRate', () => {
  test('under1y → type=short70');
  test('under2y → type=short60');
  test('over2y, taxBase=14M → type=basic, bracket=1');
  test('over2y, taxBase=287.5M → type=basic, bracket=5');
});

describe('10단계 computeCalculatedTax', () => {
  test('taxBase=92.5M × 0.6 = 55.5M (TC-002)');
  test('basic 5구간 누진 산식 (TC-001)');
});

describe('11단계 computeLocalIncomeTax', () => {
  test('Math.floor(89,310,000 × 0.1) = 8,931,000');
  test('Math.floor(0 × 0.1) = 0 (TC-003)');
});

describe('14단계 computeEffectiveTaxRate (B-008)', () => {
  test('salePrice=800M, totalTax=98,241,000 → 0.1228...');
  test('salePrice=0 → null');
});
```

#### 그룹 5 — issueFlag 발동 검증

10개 issueFlag 각각에 대해 발동·미발동 케이스를 1쌍씩.

```
test('TC-001은 LONG_TERM_DEDUCTION_NOT_APPLIED 발동 (보유 6.7년)');
test('TC-002는 LONG_TERM_DEDUCTION_NOT_APPLIED 미발동 (보유 1.7년)');
test('TC-003은 TRANSFER_LOSS_DETECTED 발동');
test('TC-001은 TRANSFER_LOSS_DETECTED 미발동');
test('saleRegulated=true 케이스에서 OUT_OF_V01_SCOPE_REGULATED_AREA 발동');
test('salePrice=1,200,000,000 → HIGH_VALUE_HOUSE 발동');
test('salePrice=1,199,999,999 → HIGH_VALUE_HOUSE 미발동');
test('NECESSARY_EXPENSE_BREAKDOWN_MISSING는 항상 발동');
test('UNREGISTERED_ASSET_ASSUMED_FALSE는 항상 발동');
test('ACQUISITION_CAUSE_ASSUMED_PURCHASE는 항상 발동');
```

#### 그룹 6 — 정수 산술 보장

```
test('TC-001 calculatedTax는 정수 (Number.isInteger)');
test('TC-001 localIncomeTax는 정수');
test('TC-001 totalTax는 정수');
test('TC-001 netAfterTaxSaleAmount는 정수');
test('전 TC에서 모든 steps 금액 필드가 정수');
```

#### 그룹 7 — 순수성 + B-008 metrics

```
test('calculateSingleTransfer는 caseData를 변경하지 않는다 (deep equal 비교)');
test('calculateSingleTransfer는 houses[0]을 변경하지 않는다');
test('동일 입력 → 동일 출력 (steps 완전 일치)');
test('metrics.totalTax === steps.totalTax (TC-001)');
test('metrics.netAfterTaxSaleAmount === steps.netAfterTaxSaleAmount (TC-001)');
test('metrics.effectiveTaxRate === totalTax / salePrice (TC-001)');
test('metrics.effectiveTaxRate === 0 (TC-003 양도차손)');
```

### 6-4. TC_GOLDEN_V01 데이터 객체

`docs/v0.1/06_test_cases.md` §8 가이드를 그대로 따라 객체 배열로 정의. 골든셋 정답값은 **하드코딩 상수**로 두되, 출처를 주석으로 명시:

```js
// 골든셋 — docs/v0.1/06_test_cases.md v0.1.1 (3자 일치 검증 완료)
var TC_GOLDEN_V01 = [
  { id: "TC-001", input: { ... }, expected: { ... } },
  { id: "TC-002", input: { ... }, expected: { ... } },
  // ... TC-005까지
];
```

> 입력 객체는 `caseData` 전체가 아닌 `calculateSingleTransfer`가 받을 수 있는 형태로 구성. House 객체와 salePlan 등 caseData 최상위 필드를 모두 포함하는 헬퍼(`buildCaseData(input)`)를 작성하면 깔끔하다.

### 6-5. 출력 보고 형식 (`tax_rules.test.js` 패턴)

```
=== tax_engine v0.1.1 회귀 테스트 ===
[1/7] selfTest 부트스트랩 ......................... 3/3 통과
[2/7] validateCaseData ............................ 9/9 통과
[3/7] 13단계 파이프라인 — TC-001~005 골든셋 ....... 5/5 통과 (각 TC당 13개 항목 검증)
[4/7] 단계별 함수 단위 테스트 ..................... XX/XX 통과
[5/7] issueFlag 발동 검증 ......................... 10/10 통과
[6/7] 정수 산술 보장 .............................. X/X 통과
[7/7] 순수성 + B-008 metrics ...................... 7/7 통과

총 XX건 통과 / 0건 실패
```

마지막 줄이 "X건 통과 / 0건 실패"로 끝나야 한다.

---

## 7. 완료 기준 체크리스트 (15항목)

본 작업의 완료는 다음 15항목을 **모두** 만족할 때 인정된다.

### 7-1. 코드 정합성

- [ ] **(1)** `js/tax_engine.js`가 `window.TaxOpt.taxEngine`을 노출한다 (모듈 스펙 §1).
- [ ] **(2)** 모듈 스펙 §2의 모든 노출 멤버가 존재한다 (ENGINE_VERSION, calculateSingleTransfer, validateCaseData, 13단계 함수들, computeEffectiveTaxRate, collectIssueFlags, selfTest).
- [ ] **(3)** 13단계 산식이 명세서 §2 표와 **완전 일치**한다 (변수명·산식·절사 모두).
- [ ] **(4)** `Math.floor` 절사가 명세서 §5에 명시된 단계(10·11)에 정확히 적용된다.
- [ ] **(5)** 모든 출력 금액 필드가 정수다 (`Number.isInteger` 통과).
- [ ] **(6)** `caseData` 입력 객체를 변경하지 않는다 (순수 함수, deep equal 검증).
- [ ] **(7)** 화면 DOM에 접근하지 않는다 (코드 내 `document`·`window.document` 사용 없음).

### 7-2. 의존성·구조

- [ ] **(8)** `tax_rules.js`만 의존하고 외부 라이브러리에 의존하지 않는다.
- [ ] **(9)** ES6 module(`import`/`export`)을 사용하지 않고 비-모듈 방식이다.
- [ ] **(10)** 부트스트랩 가드(`!window.TaxOpt.taxRules` throw)가 구현되어 있다.

### 7-3. 검증 통과

- [ ] **(11)** `selfTest()`가 `ok: true`를 반환한다 (콘솔 또는 Node.js 출력 확인).
- [ ] **(12)** `tests/tax_engine.test.js`가 Node.js 단독 실행에서 **0건 실패**를 출력한다.
- [ ] **(13)** TC-001~005 골든셋의 **13개 항목 전체**(transferGain~netAfterTaxSaleAmount + metrics)가 일치한다.

### 7-4. 통합·운영

- [ ] **(14)** `index.html`에 `<script src="js/tax_engine.js"></script>`가 추가되어 있고, `tax_rules.js` 다음 줄·인라인 `<script>` 이전 위치에 배치되어 있다 (B-003 재발 방지).
- [ ] **(15)** GitHub Pages에서 `index.html` 콘솔에 `tax_engine selfTest ok` 로그가 출력되고, `window.TaxOpt.taxEngine.calculateSingleTransfer(testCaseData)` 직접 호출이 동작한다.

---

## 8. 제약 사항

### 8-1. 기술 제약

- ES6 module(`import`/`export`) 미사용
- 모든 금액 원 단위 정수 (`Math.floor` 명시 단계만 적용, 그 외는 정수 산술)
- caseData 변경 금지 (순수 함수)
- DOM 접근 금지
- 외부 라이브러리 의존 없음
- `tax_rules.js`만 의존 가능

### 8-2. 절차 제약 (의사결정 #9 v9)

- Claude Code는 본 작업지시서 외에 작업 창과의 추가 대화 없이 단독 작성 가능해야 한다.
- 본 작업지시서의 의사코드는 참고 골격이며, Claude Code가 명세서·모듈 스펙·골든셋과 함께 자체 판단으로 구현한다.
- 산식 의문 발생 시 **명세서 v0.1.1을 정본**으로 한다. 임의 해석 금지.

### 8-3. 산식 임의 변경 금지

다음 사항은 어떤 이유로도 변경하지 않는다 (검증 완료 항목):

- 13단계 산식 (명세서 §2 표)
- 보유기간 동월동일 비교 (§3-1)
- 누진세율표 (§4-2)
- 단기세율 70%·60% (§4-1)
- 절사 정책 (§5)
- 양도차손 시 `taxBase = max(0, ...)` 처리 (§2 7단계)
- 세후 매각금액 정의 `salePrice − totalTax` (§2 13단계)

산식 변경이 필요해 보이면 **반드시** 작업 창에 보고하여 명세서 v0.2 절차로 처리.

---

## 9. 차단 사항 및 의문점 처리

### 9-1. 알려진 잠재 이슈

| 이슈 | 처리 방향 |
|---|---|
| 윤년 2/29 acquisitionDate | v0.1 골든셋에 없음. 문자열 비교 + 주석으로 처리. v0.2에서 명시적 처리 검토 (백로그 B-009 등록 권장). |
| `HOLDING_PERIOD_BOUNDARY` ±3일 판정 | 동월동일 비교는 문자열로, ±3일 판정만 `Date` 객체 사용. 단일 함수에 격리. |
| `effectiveTaxRate` 부동소수점 | `salePrice === 0`만 분기. 그 외는 그대로 반환. 회귀 테스트는 부동소수점 오차 허용 범위 ±1e-9 권장. |

### 9-2. 의문 발생 시 절차

1. 명세서 v0.1.1 (`docs/v0.1/01_calc_engine_spec.md`) 재확인
2. 모듈 스펙 (`docs/v0.1/modules/tax_engine.md`) 재확인
3. 골든셋 (`docs/v0.1/06_test_cases.md`) 재확인
4. 그래도 모호하면 **임의 해석 금지**. 작업 창에 보고하고 답변 대기.

---

## 10. 후속 작업

본 작업 완료 후:

1. **사용자 PC Node.js 회귀 테스트 실행** — `node tests/tax_engine.test.js` 결과 확인
2. **GitHub Pages 콘솔 검증** — `selfTest ok` 로그 + 임의 케이스 호출 동작
3. **의사결정 로그 갱신** — 산출물 진행 상황 표에 `tax_engine.js`, `tax_engine.test.js` 통과 기록
4. **다음 작업지시서** — `input_collector.js` (WO-04, 화면 입력 수집·정규화) 또는 `result_renderer.js` (WO-05, 결과 화면 렌더링)

본 작업이 완료되면 **v0.1 코드 단계 종료**가 선언된다 (4/29 마일스톤).

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v1.0 | 2026-04-29 | 초기 작성. 명세서 v0.1.1 + 모듈 스펙 v0.1.1 + B-008 보강(effectiveTaxRate) + 의사결정 #9 v9 (.js 본문 산출 금지) 기준. |
