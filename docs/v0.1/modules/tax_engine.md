# tax_engine.js 모듈 스펙 v0.1.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.1/modules/tax_engine.md` |
| 버전 | v0.1.1 |
| 상태 | 작성 완료 (2026-04-29) |
| 작성 출처 | 작업 창 #4 (작업지시서 02 전용) |
| 대상 코드 | `js/tax_engine.js` (Claude Code 산출) |
| 대상 테스트 | `tests/tax_engine.test.js` (Claude Code 산출) |
| 관련 작업지시서 | `docs/05_code_work_orders/02_tax_engine.md` |
| 관련 명세서 | `docs/v0.1/01_calc_engine_spec.md` v0.1.1 |
| 관련 입력 스키마 | `docs/v0.1/03_input_schema.md` v0.1.1 |
| 관련 골든셋 | `docs/v0.1/06_test_cases.md` (TC-001~005) |
| 의존 모듈 스펙 | `docs/v0.1/modules/tax_rules.md` v0.1.1 |
| 관련 의사결정 | `docs/99_decision_log.md` #5, #8, #9 v9 |
| 관련 백로그 | `docs/98_backlog.md` B-008 (effectiveTaxRate 사전 노출) |
| 다음 버전 | v0.2 (장특공·비과세·고가주택 도입 시 갱신) |

---

## 0. 문서 위치·역할

본 문서는 `js/tax_engine.js`의 **계약 문서**입니다. 호출 측(`index.html`, `result.html`, 향후 `scenario_engine.js`)이 본 모듈을 어떻게 사용해야 하는지, 그리고 본 모듈이 무엇을 보장하는지를 정의합니다.

코드 본문(`js/tax_engine.js`)과 본 문서가 충돌하면 **본 문서를 우선**합니다. 본 문서를 변경해야 하는 경우는 v0.1 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신합니다.

본 문서는 **명세서 v0.1.1의 13단계 산식을 그대로 코드 계약으로 옮긴 것**입니다. 산식·상수·issueFlag 발동 조건은 모두 명세서 §2~§8을 단일 정본으로 합니다. 본 문서가 명세서와 충돌하면 명세서가 우선합니다.

---

## 1. 노출 객체

```js
window.TaxOpt.taxEngine
```

ES6 module(`import`/`export`)을 사용하지 않습니다(decision_log #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화합니다.

`window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback합니다. `tax_rules.js`와 동일한 등록 패턴을 따릅니다.

---

## 2. 노출 멤버 (전체)

| 멤버 | 타입 | 역할 | 노출 이유 |
|---|---|---|---|
| `ENGINE_VERSION` | string | 결과 객체에 기록할 엔진 버전 식별자 | 결과 객체 추적성 |
| `calculateSingleTransfer(caseData, houseId?)` | function | 메인 진입점, 13단계 통합 실행 | 호출 측 단일 인터페이스 |
| `validateCaseData(caseData)` | function | 입력 검증 (0단계) | 호출 측이 사전 호출 가능 |
| `computeTransferGain(input)` | function | 1단계 양도차익 | 단위 테스트 가능성 |
| `applyNonTaxation(transferGain, caseData)` | function | 2단계 비과세 (v0.1 passthrough) | 인터페이스 고정, v0.2 확장점 |
| `applyHighValueAllocation(taxableGain, caseData)` | function | 3단계 고가주택 (v0.1 passthrough) | 인터페이스 고정, v0.2 확장점 |
| `computeLongTermDeduction(taxableGain, caseData)` | function | 4단계 장특공 (v0.1 = 0) | 인터페이스 고정, v0.2 확장점 |
| `computeCapitalGainIncome(taxableGain, longTermDeduction)` | function | 5단계 양도소득금액 | 단위 테스트 가능성 |
| `computeBasicDeduction(basicDeductionUsed)` | function | 6단계 기본공제 | 단위 테스트 가능성 |
| `computeTaxBase(capitalGainIncome, basicDeduction)` | function | 7단계 과세표준 | 단위 테스트 가능성 |
| `determineHoldingPeriodBranch(acquisitionDate, saleDate)` | function | 8단계 보유기간 분기 | 단위 테스트 가능성 (경계 케이스) |
| `determineAppliedRate(branch, taxBase)` | function | 9단계 적용 세율 결정 | 단위 테스트 가능성 |
| `computeCalculatedTax(taxBase, appliedRate)` | function | 10단계 산출세액 | 단위 테스트 가능성 (절사 검증) |
| `computeLocalIncomeTax(calculatedTax)` | function | 11단계 지방소득세 | 단위 테스트 가능성 (절사 검증) |
| `computeTotalTax(calculatedTax, localIncomeTax)` | function | 12단계 총 납부세액 | 단위 테스트 가능성 |
| `computeNetAfterTaxSaleAmount(salePrice, totalTax)` | function | 13단계 세후 매각금액 | 단위 테스트 가능성 |
| `computeEffectiveTaxRate(totalTax, salePrice)` | function | metrics 보강 (B-008) | 단위 테스트 가능성, salePrice=0 처리 |
| `collectIssueFlags(caseData, intermediates)` | function | issueFlag 수집 (10종) | 발동 조건 단위 테스트 가능성 |
| `selfTest()` | function | 부트스트랩 종합 자체검증 | 화면 부트스트랩 호출 |

> **노출 원칙**: 13단계 각 함수를 모두 노출하는 이유는 (1) 회귀 테스트가 단계별 중간값을 검증해야 하고, (2) v0.2에서 시나리오 엔진이 일부 단계만 재사용할 수 있어야 하기 때문. 노출은 **읽기 전용 사용**을 전제로 한다 (불변성 약속, §7).

---

## 3. 입력 caseData 스키마

`docs/v0.1/03_input_schema.md` §1, §2를 그대로 따른다. 본 문서는 다시 정의하지 않는다.

요점만 재기술:

```js
caseData = {
  baseYear:           number,
  householdMembers:   number,
  basicDeductionUsed: boolean,
  houses:             House[],   // v0.1: salePlan.candidateHouseIds.length === 1
  salePlan:           SalePlan
}

House = {
  id, nickname, location,
  acquisitionDate, acquisitionPrice, necessaryExpense, acquisitionRegulated,
  residenceMonths, livingNow,
  expectedSaleDate, expectedSalePrice, saleRegulated
}
```

### 3-1. `calculateSingleTransfer`의 houseId 인자

| houseId 값 | 동작 |
|---|---|
| 생략 또는 `undefined` | `salePlan.candidateHouseIds[0]`을 자동 선택. v0.1에서는 단일 주택이므로 사실상 `houses[0]`. |
| `"A"`, `"B"`, `"C"` 등 명시 | 해당 ID의 `House`를 검색하여 사용. 미존재 시 에러 throw. |

> v0.1에서는 단일 주택만 다루므로 호출 측은 houseId 생략 가능. v0.2 다주택 진입 시 명시 호출 권장.

### 3-2. 내부 정규화 (단축형 매핑)

`calculateSingleTransfer` 진입부에서 `House`를 다음 단축형으로 매핑한 후 13단계 함수에 전달:

```js
input = {
  salePrice:           house.expectedSalePrice,
  acquisitionPrice:    house.acquisitionPrice,
  necessaryExpense:    house.necessaryExpense,
  acquisitionDate:     house.acquisitionDate,
  saleDate:            house.expectedSaleDate,
  basicDeductionUsed:  caseData.basicDeductionUsed,
  // 보존 (issueFlag 판정용)
  acquisitionRegulated: house.acquisitionRegulated,
  saleRegulated:        house.saleRegulated,
  residenceMonths:      house.residenceMonths,
  livingNow:            house.livingNow,
  candidateHouseCount:  caseData.salePlan.candidateHouseIds.length
}
```

`expectedSaleDate`/`expectedSalePrice`를 단축형 `saleDate`/`salePrice`로 매핑하는 것은 입력 스키마 §5에서 허용된 변환이다.

---

## 4. 출력 taxResult 스키마

```js
taxResult = {
  caseId:        string,                     // 호출 측이 부여 (없으면 자동 생성)
  ruleVersion:   "v0.1.1-post-20260510",     // window.TaxOpt.taxRules.RULE_VERSION 그대로
  engineVersion: "v0.1.1-post-20260510",     // ENGINE_VERSION
  timestamp:     "ISO 8601 string",          // 결과 산출 시각

  inputsEcho: {
    /* 정규화된 단축형 input 객체 echo (§3-2) */
    salePrice, acquisitionPrice, necessaryExpense,
    acquisitionDate, saleDate, basicDeductionUsed,
    acquisitionRegulated, saleRegulated, residenceMonths, livingNow,
    candidateHouseCount, houseId
  },

  steps: {
    transferGain:           number,                              // 1단계
    taxableGain:            number,                              // 2단계 (= transferGain)
    longTermDeduction:      number,                              // 4단계 (= 0)
    capitalGainIncome:      number,                              // 5단계
    basicDeduction:         number,                              // 6단계 (0 또는 2,500,000)
    taxBase:                number,                              // 7단계
    holdingPeriodBranch:    "under1y" | "under2y" | "over2y",   // 8단계
    appliedRate: {                                              // 9단계
      type:         "short70" | "short60" | "basic",
      bracket:      number | null,                               // basic일 때 1~8, 그 외 null
      label:        string,                                      // 사람 라벨
      marginalRate: number,                                      // 0.06~0.45 또는 0.6/0.7
      baseTax:      number                                       // basic의 경우 구간 baseTax, 단기는 0
    },
    calculatedTax:          number,                              // 10단계
    localIncomeTax:         number,                              // 11단계
    totalTax:               number,                              // 12단계
    netAfterTaxSaleAmount:  number                               // 13단계
  },

  // B-008 보강 — 시나리오 비교 지표 사전 노출
  metrics: {
    totalTax:              number,                  // steps.totalTax 미러링
    netAfterTaxSaleAmount: number,                  // steps.netAfterTaxSaleAmount 미러링
    effectiveTaxRate:      number | null            // totalTax / salePrice (salePrice=0 시 null)
  },

  issueFlags: [
    { code: string, severity: "info" | "warning" | "error", message: string, lawRef: string }
  ],

  warnings: string[],

  lawRefs: [
    "소득세법 제55조 제1항", "소득세법 제95조", "소득세법 제97조",
    "소득세법 제103조", "소득세법 제104조 제1항", "지방세법 제103조의3"
  ]
}
```

### 4-1. metrics의 의미와 v0.3 연결

`metrics`는 v0.3 시나리오 엔진이 **결정될 비교 지표(B-008)에 따라 자유롭게 정렬**할 수 있도록 v0.1 단계에서 미리 노출하는 보강 영역이다.

| 멤버 | 사용처 (예정) | v0.1 동작 |
|---|---|---|
| `totalTax` | 시나리오 1 (어느 1채를 팔까) — 절댓값 비교 | 단순 출력 |
| `netAfterTaxSaleAmount` | 시나리오 2 (전부 양도, 순서) — 합계 비교 | 단순 출력 |
| `effectiveTaxRate` | 시나리오 1 보강 — 양도가액 정규화 비교 | 단순 출력 |

v0.1에서는 `metrics`를 산출만 하고 정렬·비교에 사용하지 않는다. v0.3 시나리오 엔진이 본 항목을 사용한다.

### 4-2. effectiveTaxRate 산식

```
effectiveTaxRate = (salePrice === 0) ? null : (totalTax / salePrice)
```

- 분모가 0인 케이스(`salePrice === 0`)는 v0.1 입력 검증에서 에러로 차단되지만, 안전장치로 `null` 처리.
- 비율이므로 `Math.floor` 절사하지 **않는다**. JS Number 그대로.
- 범위는 `0 ≤ effectiveTaxRate ≤ 1` (이론적). 양도차손 케이스는 `0`. 단기세율 70%·기본공제 미사용 극단 케이스에서도 `1`을 넘지 않는다(과세표준이 양도가액 이하이므로).

### 4-3. appliedRate.bracket 표기

| 분기 | type | bracket | label 예시 |
|---|---|---|---|
| under1y | "short70" | null | "단기세율 70% (1년 미만 보유)" |
| under2y | "short60" | null | "단기세율 60% (1~2년 보유)" |
| over2y | "basic" | 1~8 | "기본세율 1.5억 초과~3억 이하 (38% 누진)" |
| over2y + taxBase=0 | "basic" | 1 | "기본세율 1구간 6%" (taxBase=0이라 산출세액 0) |

label은 사람이 읽는 라벨이며, bracket이 1~8일 때는 `tax_rules.PROGRESSIVE_BRACKETS[bracket-1].label`을 그대로 사용해도 무방.

---

## 5. 13단계 파이프라인 함수 계약

각 함수는 **순수 함수**이며 입력 객체를 변경하지 않는다. 모든 금액 출력은 정수.

### 5-0. 0단계 — `validateCaseData(caseData)`

| 항목 | 내용 |
|---|---|
| 입력 | `caseData` 전체 |
| 출력 | `{ ok: boolean, errors: string[], warnings: string[] }` |
| 동작 | 명세서 §8 표를 순회하며 각 항목을 검증. 에러는 `errors`, 경고는 `warnings`에 추가. |
| 실패 처리 | `ok === false`이면 `calculateSingleTransfer`는 즉시 throw하거나 호출 측에 에러 반환. v0.1은 throw 방식 권장. |
| 부수효과 | 없음. caseData 변경 금지. |

검증 항목 (명세서 §8 그대로):

| 항목 | 규칙 | 결과 |
|---|---|---|
| `salePrice` | 정수 ≥ 1 | 에러 |
| `acquisitionPrice` | 정수 ≥ 1 | 에러 |
| `necessaryExpense` | 정수 ≥ 0 | 에러 |
| `acquisitionDate < saleDate` | 부등식 | 에러 |
| `saleDate.year === baseYear` | 권고 | 경고 |
| `saleDate ≥ APPLICABLE_SALE_DATE_FROM` | v0.1 가정 | 경고 + `OUT_OF_V01_SCOPE_DATE` issueFlag |
| `transferGain < 0` | 양도차손 | 경고 + `TRANSFER_LOSS_DETECTED` issueFlag (계산은 진행, taxBase=0 처리는 7단계에서) |
| `acquisitionRegulated || saleRegulated` | 비조정 가정 | 경고 + `OUT_OF_V01_SCOPE_REGULATED_AREA` issueFlag (계산은 일반과세로 진행) |

> 양도차손 검증은 1단계 `transferGain` 산출 후에만 가능하므로, validateCaseData는 0단계에서 정적 검증만 하고 양도차손 issueFlag는 `collectIssueFlags`에서 1단계 산출값을 받아 처리한다.

### 5-1. 1단계 — `computeTransferGain(input)`

| 항목 | 내용 |
|---|---|
| 입력 | `{ salePrice, acquisitionPrice, necessaryExpense }` |
| 출력 | `transferGain: number` (정수, 음수 가능) |
| 산식 | `salePrice − acquisitionPrice − necessaryExpense` |
| 절사 | 없음 (정수 산술) |
| 근거 | 소득세법 제95조 ①, 제96조, 제97조 |

### 5-2. 2단계 — `applyNonTaxation(transferGain, caseData)` (v0.1 passthrough)

| 항목 | 내용 |
|---|---|
| 입력 | `transferGain`, `caseData` |
| 출력 | `taxableGain: number` |
| 산식 (v0.1) | `taxableGain = transferGain` (변경 없음) |
| 산식 (v0.2 예정) | 1세대1주택 비과세 판정 후 비과세분 차감 |
| 근거 | 소득세법 제89조 (v0.2) |

> 함수 시그니처는 v0.2에서도 동일하게 유지된다. v0.1은 함수 본문에서 그대로 반환.

### 5-3. 3단계 — `applyHighValueAllocation(taxableGain, caseData)` (v0.1 passthrough)

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain`, `caseData` |
| 출력 | `taxableGain: number` (변경 없음) |
| 산식 (v0.1) | 그대로 반환 |
| 산식 (v0.2 예정) | `taxableGain × (salePrice − 12억) / salePrice` (12억 초과분 안분) |
| 근거 | 소득세법 제95조 ③ (v0.2) |

### 5-4. 4단계 — `computeLongTermDeduction(taxableGain, caseData)`

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain`, `caseData` |
| 출력 | `longTermDeduction: number` |
| 산식 (v0.1) | `0` (무조건) |
| 산식 (v0.2 예정) | 보유기간·거주기간 기반 공제율 적용 |
| 근거 | 소득세법 제95조 ② (v0.2) |
| issueFlag | 보유기간 ≥ 3년이면 `LONG_TERM_DEDUCTION_NOT_APPLIED` (info) — `collectIssueFlags`에서 처리 |

### 5-5. 5단계 — `computeCapitalGainIncome(taxableGain, longTermDeduction)`

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain`, `longTermDeduction` |
| 출력 | `capitalGainIncome: number` |
| 산식 | `taxableGain − longTermDeduction` |
| v0.1 결과 | `transferGain`과 동일 |
| 근거 | 소득세법 제95조 ① |

### 5-6. 6단계 — `computeBasicDeduction(basicDeductionUsed)`

| 항목 | 내용 |
|---|---|
| 입력 | `basicDeductionUsed: boolean` |
| 출력 | `basicDeduction: number` |
| 산식 | `basicDeductionUsed ? 0 : tax_rules.BASIC_DEDUCTION_AMOUNT` |
| v0.1 값 | `0` 또는 `2,500,000` |
| 근거 | 소득세법 제103조 |

> 상수는 반드시 `tax_rules.BASIC_DEDUCTION_AMOUNT`에서 가져와야 한다. 하드코딩 금지.

### 5-7. 7단계 — `computeTaxBase(capitalGainIncome, basicDeduction)`

| 항목 | 내용 |
|---|---|
| 입력 | `capitalGainIncome`, `basicDeduction` |
| 출력 | `taxBase: number` (정수, ≥ 0) |
| 산식 | `Math.max(0, capitalGainIncome − basicDeduction)` |
| 근거 | 소득세법 제92조 ③ |
| 비고 | 양도차손 발생 시 자동으로 0이 됨 (TC-003 검증) |

### 5-8. 8단계 — `determineHoldingPeriodBranch(acquisitionDate, saleDate)`

| 항목 | 내용 |
|---|---|
| 입력 | `acquisitionDate: "YYYY-MM-DD"`, `saleDate: "YYYY-MM-DD"` |
| 출력 | `"under1y" \| "under2y" \| "over2y"` |
| 산식 | 동월동일 비교 (명세서 §3-1) |
| 근거 | 소득세법 제95조 ④ |

분기 규칙 (명세서 §3-1 그대로):

```
oneYearMark = acquisitionDate + 1년 (동월동일)
twoYearMark = acquisitionDate + 2년 (동월동일)

if (saleDate <  oneYearMark) → "under1y"
if (saleDate <  twoYearMark) → "under2y"
else                          → "over2y"
```

경계 처리 (명세서 §3-2):
- `saleDate === oneYearMark` → "1년 이상" (under1y 아님)
- `saleDate === twoYearMark` → "2년 이상" (under2y 아님)
- 양도일이 oneYearMark 또는 twoYearMark의 ±3일 이내 → `HOLDING_PERIOD_BOUNDARY` issueFlag (warning) 발동 — `collectIssueFlags`에서 처리

> JS의 `Date` 객체는 윤년·말일(2/28→2/29) 처리에 함정이 있다. 동월동일 비교는 문자열 비교 또는 연/월/일 정수 비교로 구현해야 한다. `Date` 산술은 권장하지 않는다. 구체적 구현은 작업지시서 02 §3-8에서 다룬다.

### 5-9. 9단계 — `determineAppliedRate(branch, taxBase)`

| 항목 | 내용 |
|---|---|
| 입력 | `branch`, `taxBase` |
| 출력 | `appliedRate: object` (§4 출력 스키마 참조) |
| 산식 | branch별 분기 |
| 근거 | 소득세법 제104조 ①, 제55조 ① |

분기 규칙:

| branch | type | marginalRate | baseTax | bracket | label |
|---|---|---|---|---|---|
| under1y | "short70" | `tax_rules.SHORT_TERM_RATE_UNDER_1Y` (=0.7) | 0 | null | "단기세율 70% (1년 미만 보유)" |
| under2y | "short60" | `tax_rules.SHORT_TERM_RATE_UNDER_2Y` (=0.6) | 0 | null | "단기세율 60% (1~2년 보유)" |
| over2y | "basic" | `bracket.marginalRate` | `bracket.baseTax` | `bracket.idx` | `bracket.label` |

over2y의 경우 `bracket = tax_rules.findBracket(taxBase)` 호출로 구간 결정.

> v0.1에서 비교산출세액(제104조 ① 후단)은 발동하지 않는다(명세서 §4-4). 단일 주택 일반과세에서는 한 가지 분기만 적용되므로 비교 대상 없음.

### 5-10. 10단계 — `computeCalculatedTax(taxBase, appliedRate)`

| 항목 | 내용 |
|---|---|
| 입력 | `taxBase`, `appliedRate` |
| 출력 | `calculatedTax: number` (정수) |
| 절사 | `Math.floor` (명세서 §5) |
| 근거 | 소득세법 제55조 ①, 제104조 ① |

산식:

```
if (appliedRate.type === "short70") {
  calculatedTax = Math.floor(taxBase × 0.7)
}
else if (appliedRate.type === "short60") {
  calculatedTax = Math.floor(taxBase × 0.6)
}
else if (appliedRate.type === "basic") {
  // bracket 정보 사용
  calculatedTax = Math.floor(
    appliedRate.baseTax + (taxBase − bracket.lowerBound) × appliedRate.marginalRate
  )
}
```

> `bracket.lowerBound`는 9단계에서 결정된 bracket 객체 참조에서 가져온다. 9단계 출력에 `lowerBound`를 포함시키거나, 10단계에서 `tax_rules.findBracket(taxBase)`을 다시 호출해도 무방. 후자가 더 단순하므로 작업지시서 02에서 후자 권장.

### 5-11. 11단계 — `computeLocalIncomeTax(calculatedTax)`

| 항목 | 내용 |
|---|---|
| 입력 | `calculatedTax` |
| 출력 | `localIncomeTax: number` (정수) |
| 산식 | `Math.floor(calculatedTax × tax_rules.LOCAL_INCOME_TAX_RATE)` |
| 절사 | `Math.floor` |
| 근거 | 지방세법 제103조의3 |

### 5-12. 12단계 — `computeTotalTax(calculatedTax, localIncomeTax)`

| 항목 | 내용 |
|---|---|
| 입력 | `calculatedTax`, `localIncomeTax` |
| 출력 | `totalTax: number` (정수) |
| 산식 | `calculatedTax + localIncomeTax` |
| 절사 | 없음 (정수 합) |

### 5-13. 13단계 — `computeNetAfterTaxSaleAmount(salePrice, totalTax)`

| 항목 | 내용 |
|---|---|
| 입력 | `salePrice`, `totalTax` |
| 출력 | `netAfterTaxSaleAmount: number` (정수) |
| 산식 | `salePrice − totalTax` |
| 절사 | 없음 (정수 차) |
| v0.1 정의 주석 | 명세서 §2 주석 그대로: "취득가액·필요경비는 사전 지출이므로 회수 자금에서 차감하지 않음" |

### 5-14. 보강 — `computeEffectiveTaxRate(totalTax, salePrice)` (B-008)

| 항목 | 내용 |
|---|---|
| 입력 | `totalTax`, `salePrice` |
| 출력 | `effectiveTaxRate: number \| null` |
| 산식 | `salePrice === 0 ? null : totalTax / salePrice` |
| 절사 | 없음 (비율) |
| v0.1 사용처 | 산출만 하고 비교에 사용 안 함 |
| v0.3 사용처 (예정) | 시나리오 1 비교 지표 |

### 5-15. 메인 — `calculateSingleTransfer(caseData, houseId?)`

| 항목 | 내용 |
|---|---|
| 입력 | `caseData`, `houseId?` |
| 출력 | `taxResult: object` (§4 스키마) |
| 동작 | 0단계 → 1단계 → ... → 13단계 → effectiveTaxRate → collectIssueFlags → 결과 객체 조립 |
| 부수효과 | 없음 |
| 입력 변경 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 (`timestamp` 제외) |
| 예외 | validateCaseData 실패 시 throw |

> `timestamp`는 비결정성 항목이므로 회귀 테스트에서 제외하거나 모킹한다.

---

## 6. 자체검증 함수 계약

### 6-1. `selfTest()`

| 항목 | 내용 |
|---|---|
| 입력 | 없음 |
| 출력 | `{ ok: boolean, taxRulesSelfTest: object, sanityChecks: object }` |
| 부수효과 | 없음. 실패해도 throw하지 않음. |
| 호출 권장 시점 | 페이지 부트스트랩 1회. `ok === false`이면 호출 측이 결과 산출을 차단. |

내부 동작:

1. `tax_rules.selfTest()` 호출 — 결과를 `taxRulesSelfTest`로 보관.
2. **Sanity 체크 (최소 3건)**: TC-001·TC-003·TC-005 입력에 대해 `calculateSingleTransfer`를 실행하고 골든셋 totalTax와 일치하는지 확인.
3. 모두 통과 시 `ok: true`.

> Sanity 체크는 회귀 테스트(`tax_engine.test.js`)와 별개로, **부트스트랩 시점에 항상 동작**해야 하는 최소 검증이다. 화면 첫 로드 시 콘솔에 `selfTest ok: true`가 찍히면 통과.

### 6-2. `collectIssueFlags(caseData, intermediates)` 의 책임 분리

`collectIssueFlags`는 자체검증 함수가 아니라 **issueFlag 수집 함수**다. 자체검증과 분리해서 구현한다. 구체 발동 조건은 §5 issueFlag 카탈로그 참조.

---

## 7. 불변성 약속

- 호출자는 `window.TaxOpt.taxEngine`이 노출하는 객체를 변경하지 않는다.
- `calculateSingleTransfer`는 입력 `caseData`를 변경하지 않는다 (검증 대상).
- 13단계 각 함수는 입력값을 변경하지 않는다.
- 본 모듈은 `Object.freeze`를 적용하지 않는다(v0.1). v0.2에서 검토.
- 본 모듈은 DOM에 접근하지 않는다.
- 본 모듈은 외부 라이브러리에 의존하지 않는다.

---

## 8. 의존성

| 의존 | 종류 | 비고 |
|---|---|---|
| `window.TaxOpt.taxRules` | TaxOpt 모듈 (선행 로드 필수) | `tax_rules.js`가 `tax_engine.js`보다 먼저 `<script>` 로드 |
| 외부 라이브러리 | 없음 | — |
| DOM | 사용 없음 | — |
| 전역 부수효과 | `window.TaxOpt.taxEngine` 등록만 | — |

### 8-1. tax_rules.js 사용 항목

| 사용 멤버 | 사용 단계 |
|---|---|
| `tax_rules.selfTest()` | tax_engine.selfTest() 부트스트랩 |
| `tax_rules.BASIC_DEDUCTION_AMOUNT` | 6단계 |
| `tax_rules.LOCAL_INCOME_TAX_RATE` | 11단계 |
| `tax_rules.SHORT_TERM_RATE_UNDER_1Y` | 9·10단계 (under1y) |
| `tax_rules.SHORT_TERM_RATE_UNDER_2Y` | 9·10단계 (under2y) |
| `tax_rules.findBracket(taxBase)` | 9·10단계 (over2y) |
| `tax_rules.RULE_VERSION` | 결과 객체 ruleVersion |
| `tax_rules.APPLICABLE_SALE_DATE_FROM` | 0단계 검증 (saleDate ≥ 2026-05-10) |
| `tax_rules.LAW_REFS` | 결과 객체 lawRefs |

### 8-2. 부트스트랩 가드

`calculateSingleTransfer`의 진입부에서 다음 가드를 둔다:

```js
if (!window.TaxOpt || !window.TaxOpt.taxRules) {
  throw new Error('tax_engine: tax_rules.js가 먼저 로드되어야 합니다.');
}
```

`<script>` 로드 순서가 잘못되었을 때 실패를 명시적으로 표면화하기 위함이다.

---

## 9. 비책임 (out of scope)

본 모듈은 다음을 **수행하지 않습니다**. 모두 다른 모듈의 책임입니다.

| 항목 | 담당 모듈 |
|---|---|
| 화면 입력값 수집·정규화 (`collectCaseData`) | `input_collector.js` (WO-04, 미정) |
| 화면 DOM 접근·이벤트 처리 | 호출 측 (`index.html`, `result.html`) |
| 결과 화면 렌더링 (`renderTaxResult`) | `result_renderer.js` (WO-05, 미정) |
| 사용자 친화적 설명 문장 생성 | `explanation_engine.js` |
| 시나리오 조합 생성·순서 비교 | `scenario_engine.js` (v0.3) |
| 1세대1주택 비과세 정확 판정 | v0.2 명세서 |
| 고가주택 12억 초과분 안분 | v0.2 명세서 |
| 장기보유특별공제 | v0.2 명세서 |
| 다주택 중과·중과 유예 | v0.3 명세서 |
| 세율표·공제액·기준금액 정의 | `tax_rules.js` |
| `tax_rules` 자체검증 | `tax_rules.js` (`tax_rules.selfTest()`) |

---

## 10. 호출 측 사용 예시 (참고)

### 10-1. 부트스트랩

```js
// index.html 또는 result.html에서
window.addEventListener('DOMContentLoaded', function () {
  var st = window.TaxOpt.taxEngine.selfTest();
  if (!st.ok) {
    console.error('tax_engine selfTest 실패:', st);
    // 결과 산출 UI 비활성화
  } else {
    console.log('tax_engine selfTest ok:', st);
  }
});
```

### 10-2. 단일 주택 계산 호출

```js
// index.html에서 입력 수집 후
var caseData = collectCaseData();   // input_collector.js (WO-04 산출)
var taxResult = window.TaxOpt.taxEngine.calculateSingleTransfer(caseData);

// result.html에서 렌더링 (WO-05 산출)
renderTaxResult(taxResult);
```

### 10-3. 단계별 함수 직접 호출 (회귀 테스트 또는 v0.3 시나리오 엔진)

```js
var engine = window.TaxOpt.taxEngine;
var transferGain = engine.computeTransferGain({
  salePrice:        800000000,
  acquisitionPrice: 500000000,
  necessaryExpense:  10000000
});
// transferGain === 290000000
```

> 위는 의사 예시이며, 실제 구현 코드는 Claude Code가 작성한다(의사결정 #9 v9).

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.1 | 2026-04-29 | 초기 작성. 명세서 v0.1.1 + tax_rules 모듈 스펙 v0.1.1 + B-008 보강(effectiveTaxRate) 기준. |

본 문서는 v0.1 명세서가 변경되지 않는 한 함께 변경되지 않습니다. v0.2에서 비과세·고가주택·장특공이 추가되면 §5의 2·3·4단계 함수 본문이 확장되며, 그때는 본 문서를 v0.2로 갱신하거나 별도로 `docs/v0.2/modules/tax_engine.md`를 작성합니다.
