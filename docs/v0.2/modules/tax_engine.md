# tax_engine.js 모듈 스펙 v0.2.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.2/modules/tax_engine.md` |
| 버전 | v0.2.1 (검증 통과 + 산식 표기 정정) |
| 상태 | 작성 완료 (2026-04-30 v0.2.0 → 2026-05-01 v0.2.1, 검증 후) |
| 작성 출처 | 작업 창 #6 (v0.2 명세서 작성 전용) |
| 대상 코드 | `js/tax_engine.js` (Claude Code 산출, v0.2 패치) |
| 대상 테스트 | `tests/tax_engine.test.js` (Claude Code 산출, v0.2 패치) |
| 관련 작업지시서 | `docs/05_code_work_orders/04_tax_engine_v0.2.md` (예정, 5/1 작성) |
| 관련 명세서 | `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (✅ 검증 통과) |
| 관련 입력 스키마 | `docs/v0.2/03_input_schema.md` v0.2.0 |
| 관련 골든셋 | `docs/v0.2/06_test_cases.md` v0.2.1 (✅ TC-006~010 3자 일치) + `docs/v0.1/06_test_cases.md` (TC-001~005, 회귀) |
| 의존 모듈 스펙 | `docs/v0.2/modules/tax_rules.md` v0.2.0 (예정, **장특공 룩업 테이블 정본** — §0-1) |
| 관련 의사결정 | `docs/99_decision_log.md` #5 (강화: 법령 개정 대응 아키텍처), #8, #9 v9, #10 |
| 관련 백로그 | B-008 (effectiveTaxRate 사전 노출, v0.1에서 처리), B-009 (1세대1주택 비과세 — v0.2에서 처리), **B-020 (장특공 산식 → 룩업 테이블 통일, v0.2.1)**, B-021 (법제처 OpenAPI 활용 검토) |
| 이전 버전 | v0.1.1 (단일 주택 일반과세, 13단계 파이프라인 본문 확정) |
| 다음 버전 | v0.3 (다주택 중과·시나리오 엔진 도입 시 갱신) |

---

## 0. 문서 위치·역할

본 문서는 `js/tax_engine.js`의 **계약 문서 v0.2판**입니다. v0.1.1 모듈 스펙을 베이스로 하여, v0.2 명세서가 활성화한 단계 2(1세대1주택 비과세)·단계 3(고가주택 안분)·단계 4(장기보유특별공제 표 1·2)의 계약을 추가합니다.

코드 본문(`js/tax_engine.js`)과 본 문서가 충돌하면 **본 문서를 우선**합니다. 본 문서를 변경해야 하는 경우는 v0.2 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신합니다.

본 문서는 **명세서 v0.2.0의 13단계 산식을 그대로 코드 계약으로 옮긴 것**입니다. 산식·상수·issueFlag 발동 조건은 모두 명세서 §2~§8을 단일 정본으로 합니다. 본 문서가 명세서와 충돌하면 명세서가 우선합니다.

### 0-1. v0.1.1 → v0.2.0 변경 요약

| 영역 | v0.1.1 | v0.2.0 |
|---|---|---|
| 노출 멤버 | 17종 | **20종** (신규 3) |
| 단계 2 (비과세) | passthrough | **1세대1주택 비과세 본문 활성** |
| 단계 3 (고가주택 안분) | passthrough | **12억 초과 안분 본문 활성** |
| 단계 4 (장특공) | 항상 0 | **표 1·2 분기 본문 활성** |
| `result.steps` 필드 | 13단계 산출값 | + **10개 v0.2 신규 필드** |
| issueFlag | 10종 | **18종** (신규 5 + 보조 3, 변경 5, 유지 5, 폐기 1) |
| `tax_rules.js` 의존 | 누진세율표·기본공제 | + **장특공 표 1·2 산출 상수 (또는 함수)** ※ 작업지시서 03(또는 04)에서 추가 산출 |

---

## 1. 노출 객체

```js
window.TaxOpt.taxEngine
```

ES6 module(`import`/`export`)을 사용하지 않습니다(decision_log #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화합니다.

`window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback합니다. v0.1과 동일.

---

## 2. 노출 멤버 (전체, v0.2)

> v0.1 노출 멤버는 **모두 시그니처 유지**한다. v0.2 신규는 별도 표기.

| 멤버 | 타입 | 역할 | v0.2 변경 |
|---|---|---|---|
| `ENGINE_VERSION` | string | 결과 객체에 기록할 엔진 버전 식별자 | `"v0.2.0"`로 갱신 |
| `calculateSingleTransfer(caseData, houseId?)` | function | 메인 진입점, 13단계 통합 실행 | 단계 2·3·4 활성, 출력 스키마 보강 |
| `validateCaseData(caseData)` | function | 입력 검증 (0단계) | v0.2 신규 검증 항목 추가 (§7) |
| `computeTransferGain(input)` | function | 1단계 양도차익 | 동일 |
| `applyNonTaxation(transferGain, caseData)` | function | 2단계 비과세 | **본문 활성**: 내부에서 `check1Se1HouseExemption` 호출 |
| `applyHighValueAllocation(taxableGain, caseData)` | function | 3단계 고가주택 안분 | **본문 활성**: 내부에서 `calculateHighValuePortion` 호출 |
| `computeLongTermDeduction(taxableGain, caseData)` | function | 4단계 장특공 | **본문 활성**: 내부에서 `calculateLongTermDeduction` 분기 호출 |
| `computeCapitalGainIncome(taxableGain, longTermDeduction)` | function | 5단계 양도소득금액 | 동일 |
| `computeBasicDeduction(basicDeductionUsed)` | function | 6단계 기본공제 | 동일 |
| `computeTaxBase(capitalGainIncome, basicDeduction)` | function | 7단계 과세표준 | 동일 |
| `determineHoldingPeriodBranch(acquisitionDate, saleDate)` | function | 8단계 보유기간 분기 | 동일 |
| `determineAppliedRate(branch, taxBase)` | function | 9단계 적용 세율 결정 | 동일 |
| `computeCalculatedTax(taxBase, appliedRate)` | function | 10단계 산출세액 | 동일 |
| `computeLocalIncomeTax(calculatedTax)` | function | 11단계 지방소득세 | 동일 |
| `computeTotalTax(calculatedTax, localIncomeTax)` | function | 12단계 총 납부세액 | 동일 |
| `computeNetAfterTaxSaleAmount(salePrice, totalTax)` | function | 13단계 세후 매각금액 | 동일 |
| `computeEffectiveTaxRate(totalTax, salePrice)` | function | metrics 보강 (B-008) | 동일 |
| `collectIssueFlags(caseData, intermediates)` | function | issueFlag 수집 | **18종으로 확장** (§5) |
| `selfTest()` | function | 부트스트랩 종합 자체검증 | TC-006·TC-008·TC-010 sanity 추가 권장 |
| **`check1Se1HouseExemption(input)`** | function | **(신규)** 1세대1주택 비과세 판단 | v0.2 신규 |
| **`calculateHighValuePortion(input)`** | function | **(신규)** 고가주택 안분 산식 | v0.2 신규 |
| **`calculateLongTermDeduction(input)`** | function | **(신규)** 장특공 표 1·2 산출 분기 | v0.2 신규 |

> **노출 원칙**: v0.1과 동일. 13단계 각 함수와 v0.2 신규 보조 함수 3종을 모두 노출하는 이유는 (1) 회귀 테스트가 단계별 중간값을 검증해야 하고, (2) v0.3 시나리오 엔진이 일부 단계만 재사용할 수 있어야 하기 때문. 노출은 **읽기 전용 사용**을 전제로 한다 (불변성 약속, §7).

---

## 3. 입력 caseData 스키마

`docs/v0.2/03_input_schema.md` v0.2.0 §1, §2를 그대로 따른다. 본 문서는 다시 정의하지 않는다.

요점만 재기술:

```js
caseData = {
  baseYear:              number,
  householdMembers:      number,
  basicDeductionUsed:    boolean,
  householdHouseCount:   number,        // v0.2 신규 (1세대 보유 주택 수)
  isOneTimeTwoHouses:    boolean,       // v0.2 신규 (일시적 2주택, 미적용 issueFlag만)
  specialTaxFlags:       object,        // v0.1.2 사전 노출, v0.2 미사용
  specialTaxRequirementsMet: string[],  // v0.1.2 사전 노출, v0.2 미사용
  houses:                House[],       // v0.2: salePlan.candidateHouseIds.length === 1 (단일 양도, 다주택 보유 가능)
  salePlan:              SalePlan
}

House = {
  id, nickname, location,
  acquisitionDate, acquisitionPrice, necessaryExpense,
  acquisitionRegulated,                 // v0.2 활성 (취득시 조정대상지역 → 거주요건 판단)
  residenceMonths,                      // v0.2 활성 (거주기간 — 표 2, 비과세 거주요건)
  livingNow,                            // v0.2 활성 (현재 거주 여부 — 거주기간 검증 보조)
  expectedSaleDate, expectedSalePrice, saleRegulated
}
```

### 3-1. v0.2에서 활성화된 House 필드 의미

| 필드 | v0.1 처리 | v0.2 처리 |
|---|---|---|
| `acquisitionRegulated` | issueFlag만 (`OUT_OF_V01_SCOPE_REGULATED_AREA`) | **거주요건 판단**: true이면 비과세 적용에 거주 ≥ 24개월 필요. issueFlag는 양도시(saleRegulated)만 발동으로 변경 |
| `residenceMonths` | 입력만 받고 미사용 | **사용**: 비과세 거주요건(≥24)·표 2 거주공제율(연차 산정) |
| `livingNow` | 입력만 받고 미사용 | **사용**: `residenceMonths` 검증 보조 (현재 거주 중인데 0이면 입력 오류 의심) — `RESIDENCE_MONTHS_USER_INPUT` issueFlag |

---

## 4. 출력 객체 스키마

`calculateSingleTransfer`는 v0.1 출력 스키마를 그대로 유지하면서 `result.steps`에 v0.2 신규 필드 10개를 추가한다.

### 4-1. 결과 객체 톱레벨 (v0.1 동일)

```js
result = {
  engineVersion:    string,    // "v0.2.0"
  ruleVersion:      string,    // tax_rules.RULE_VERSION
  lawRefs:          object,    // tax_rules.LAW_REFS
  caseDataSnapshot: object,    // 입력 캡처 (불변성 검증용)
  steps:            object,    // §4-2 (v0.2 보강)
  totalTax:         number,
  netAfterTaxSaleAmount: number,
  effectiveTaxRate: number | null,
  issueFlags:       IssueFlag[],
  timestamp:        string     // ISO 8601 (비결정성 항목)
}
```

### 4-2. `result.steps` 구조 (v0.2 보강)

> v0.1 필드는 **이름·타입 유지**. v0.2 신규 필드만 추가.

| 필드 | 타입 | v0.1 | v0.2 의미 |
|---|---|---|---|
| `transferGain` | number | ✅ | 1단계 양도차익 |
| `taxableGain` | number | ✅ | 3단계 후 과세대상 양도차익 (안분 적용 시 안분 후 값) |
| `nonTaxableGain` | number | ✅ | 비과세분 (= transferGain − taxableGain) |
| `longTermDeduction` | number | ✅ (=0) | 4단계 장특공 (v0.2: 표 1·2 분기 산출) |
| `capitalGainIncome` | number | ✅ | 5단계 양도소득금액 |
| `basicDeduction` | number | ✅ | 6단계 기본공제 |
| `taxBase` | number | ✅ | 7단계 과세표준 |
| `holdingPeriodBranch` | string | ✅ | 8단계 분기 (`under1y`·`under2y`·`over2y`) |
| `appliedRate` | number \| object | ✅ | 9단계 적용 세율(단기) 또는 누진 구간 객체 |
| `calculatedTax` | number | ✅ | 10단계 산출세액 |
| `localIncomeTax` | number | ✅ | 11단계 지방소득세 |
| **`is1Se1House`** | boolean | ❌ | (신규) 1세대1주택 비과세 적용 여부 |
| **`isHighValueHouse`** | boolean | ❌ | (신규) 12억 초과 → 안분 진입 여부 |
| **`allocationRatio`** | number | ❌ | (신규) 안분비율. 비과세 미적용·12억 이하 비과세 시 `1.0`. 안분 진입 시 `(salePrice − 12억) / salePrice` |
| **`appliedDeductionTable`** | `1` \| `2` \| `null` | ❌ | (신규) 적용 장특공 표. 보유<3년 또는 비과세 종료 시 `null` |
| **`holdingYears`** | number | ❌ | (신규) 보유 정수 연차. 표 1·2 산출 입력 |
| **`residenceYears`** | number | ❌ | (신규) 거주 정수 연차. 표 2 거주공제율 산출 입력 |
| **`holdingRate`** | number | ❌ | (신규) 보유공제율 (표 1·2 공통). 표 1: 6~30%, 표 2: 12~40% |
| **`residenceRate`** | number | ❌ | (신규) 거주공제율 (표 2 한정). 표 1 적용 시 0 |
| **`totalRate`** | number | ❌ | (신규) 적용 공제율 합계 (longTermDeduction = floor(taxableGain × totalRate)) |
| **`terminateAt2`** | boolean | ❌ | (신규) 단계 2에서 파이프라인 종료 여부 (12억 이하 비과세 시 true) |

#### 4-2-1. `terminateAt2 === true`일 때의 후속 단계 값 일관성

명세서 §2 단계 2 종료 시, 후속 단계의 `result.steps` 값은 **명시적 0 또는 null**로 채운다 (결과 객체 일관성 약속):

| 필드 | terminateAt2=true 시 값 |
|---|---|
| `taxableGain` | 0 |
| `longTermDeduction` | 0 |
| `capitalGainIncome` | 0 |
| `basicDeduction` | 0 |
| `taxBase` | 0 |
| `holdingPeriodBranch` | 산출 후 그대로 기록 (정보 보존) |
| `appliedRate` | null |
| `calculatedTax` | 0 |
| `localIncomeTax` | 0 |
| `appliedDeductionTable` | null |
| `holdingRate` | 0 |
| `residenceRate` | 0 |
| `totalRate` | 0 |
| `nonTaxableGain` | transferGain (전액 비과세) |
| `allocationRatio` | 1.0 (실질 안분 없음, 형식상 1.0) |
| `result.totalTax` | 0 |
| `result.netAfterTaxSaleAmount` | salePrice |
| `result.effectiveTaxRate` | 0 (totalTax/salePrice = 0) |

> 이는 호출 측이 `result.steps.calculatedTax === 0` 같은 단순 비교로 안전하게 분기할 수 있도록 보장하기 위함이다. `undefined` 누락 금지.

---

## 5. 13단계 파이프라인 함수 계약 (v0.2 변경분만)

> 본 절은 v0.1과 **달라진 단계 2·3·4**만 다룬다. 단계 0·1·5~13은 v0.1.1 모듈 스펙과 **완전 동일**하므로 본 문서에서 재정의하지 않는다.

### 5-1. 단계 2 — `applyNonTaxation(transferGain, caseData)` (v0.2 활성)

| 항목 | 내용 |
|---|---|
| 입력 | `transferGain` (number, 1단계 결과), `caseData` |
| 출력 | `{ taxableGain: number, nonTaxableGain: number, is1Se1House: boolean, isHighValueHouse: boolean, terminateAt2: boolean, holdingYears: number, residenceYears: number }` |
| 산식 | (1) `check1Se1HouseExemption(input)` 호출 → `{ is1Se1House, isHighValueHouse, terminateAt2, holdingYears, residenceYears }` 산출. (2) `terminateAt2 === true`이면 `{ taxableGain: 0, nonTaxableGain: transferGain, ... }`. (3) `is1Se1House && isHighValueHouse`이면 단계 3에서 안분 처리 위임. 본 단계에서는 `taxableGain = transferGain` 그대로 통과. (4) 비과세 미적용이면 `taxableGain = transferGain`. |
| 절사 | 본 단계 자체 절사 없음 (단계 3 안분 또는 단계 4·5에서 절사). |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `check1Se1HouseExemption` 내부 예외 발생 시 throw |
| issueFlag 트리거 | `IS_1SE_1HOUSE` (is1Se1House=true 시), `RESIDENCE_MONTHS_USER_INPUT` (항상), `RESIDENCE_EXEMPTION_NOT_HANDLED` (해당 시), `ONE_TIME_2HOUSES_NOT_APPLIED` (`isOneTimeTwoHouses=true` 시 — 본 단계에서 발동, 비과세 적용은 안 함) |

#### 5-1-1. 보조 — `check1Se1HouseExemption(input)` (v0.2 신규 노출)

명세서 §3 결정 트리를 그대로 옮긴다.

| 항목 | 내용 |
|---|---|
| 입력 | `{ householdHouseCount, acquisitionDate, saleDate, acquisitionRegulated, residenceMonths, salePrice }` |
| 출력 | `{ is1Se1House: boolean, isHighValueHouse: boolean, terminateAt2: boolean, holdingYears: number, residenceYears: number, reason: string }` |
| 산식 | (a) `householdHouseCount === 1`이 아니면 `is1Se1House=false`, `terminateAt2=false`, `reason="MULTI_HOUSE"`. (b) 보유연수 산정: `holdingYears = floor((saleDate − acquisitionDate)/365.25)`. 보유 < 2년이면 `is1Se1House=false`, `reason="HOLDING_LT_2Y"`. (c) `acquisitionRegulated === true`이고 `residenceMonths < 24`이면 `is1Se1House=false`, `reason="RESIDENCE_LT_24M_REGULATED"`. (d) 그 외는 `is1Se1House=true`. (e) `is1Se1House=true && salePrice <= 1,200,000,000`이면 `terminateAt2=true`, `isHighValueHouse=false`, `reason="EXEMPT_UNDER_12B"`. (f) `is1Se1House=true && salePrice > 1,200,000,000`이면 `terminateAt2=false`, `isHighValueHouse=true`, `reason="HIGH_VALUE_ALLOCATION"`. |
| 절사 | `holdingYears`·`residenceYears`는 정수 절사 (소수 버림) |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `acquisitionDate`·`saleDate` 파싱 실패 시 throw |

> `residenceYears`는 본 함수에서 산출하지 않아도 무방하나, 단계 4에서 재사용하므로 함께 산출하여 반환한다 (`residenceYears = floor(residenceMonths / 12)`).

> **거주연수 산정 일관성**: 명세서 §5-5에 따라 표 2 산출의 거주연수는 본 함수가 반환한 값을 단계 4가 그대로 사용한다 (재산정 금지).

### 5-2. 단계 3 — `applyHighValueAllocation(taxableGain, caseData)` (v0.2 활성)

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain` (단계 2 결과), `caseData` |
| 출력 | `{ taxableGain: number, allocationRatio: number, isHighValueHouse: boolean }` |
| 산식 | (1) 단계 2의 `isHighValueHouse === false`이면 `{ taxableGain, allocationRatio: 1.0, isHighValueHouse: false }` 그대로 통과 (절사 없음). (2) `isHighValueHouse === true`이면 `calculateHighValuePortion({ transferGain: taxableGain, salePrice })` 호출. |
| 절사 | 안분 적용 시 `Math.floor` 1회 (명세서 §4-3 절사 정책). |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | salePrice ≤ 0 또는 salePrice ≤ 1,200,000,000인데 안분 진입 시 assertion throw (validateCaseData에서 사전 차단되어야 함) |
| issueFlag 트리거 | `IS_HIGH_VALUE_HOUSE` (안분 진입 시 + 비과세 적용 케이스), `HIGH_VALUE_HOUSE` (12억 초과 + 비과세 미적용 케이스) |

#### 5-2-1. 보조 — `calculateHighValuePortion(input)` (v0.2 신규 노출)

| 항목 | 내용 |
|---|---|
| 입력 | `{ transferGain, salePrice }` |
| 출력 | `{ taxableGain: number, allocationRatio: number }` |
| 산식 | `allocationRatio = (salePrice − 1,200,000,000) / salePrice`. `taxableGain = Math.floor(transferGain × allocationRatio)`. |
| 절사 | `taxableGain`만 floor. `allocationRatio`는 비율(절사 없음). |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `salePrice <= 1,200,000,000`이면 throw (assertion 실패) |

> **장특공 동시 안분 폐기 (수학적 동치)**: 안분비율이 양도차익과 장특공 양쪽에 곱해지는 시행령 제160조의 본래 산식은 단계 4의 (안분 차익 × 공제율) 한 번 곱셈으로 수학적으로 동치이므로, 본 모듈은 단계 3에서 1회 절사로 통일한다 (명세서 §4-3).

### 5-3. 단계 4 — `computeLongTermDeduction(taxableGain, caseData)` (v0.2 활성)

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain` (단계 3 결과), `caseData` (보유연수·거주연수·is1Se1House·isHighValueHouse를 단계 2·3 결과에서 전달받음) |
| 출력 | `{ longTermDeduction: number, appliedDeductionTable: 1\|2\|null, holdingRate: number, residenceRate: number, totalRate: number }` |
| 산식 | `calculateLongTermDeduction({ taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse })` 호출 결과 그대로 반환. |
| 절사 | `longTermDeduction = Math.floor(taxableGain × totalRate)` 1회. |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `holdingYears < 0` 등 음수 입력 시 throw |
| issueFlag 트리거 | `LONG_TERM_DEDUCTION_TABLE_1`·`LONG_TERM_DEDUCTION_TABLE_2` (적용 표에 따라), `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2` (1세대1주택 12억 초과지만 보유<3년) |

#### 5-3-1. 보조 — `calculateLongTermDeduction(input)` (v0.2 신규 노출)

명세서 §5-2·§5-3 산식을 그대로 옮긴다 (v0.2.1 룩업 테이블 방식).

| 항목 | 내용 |
|---|---|
| 입력 | `{ taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse }` |
| 출력 | `{ longTermDeduction: number, appliedDeductionTable: 1\|2\|null, holdingRate: number, residenceRate: number, totalRate: number }` |
| 산식 (v0.2.1) | (a) **표 적용 자격 판정**: `is1Se1House && isHighValueHouse && holdingYears >= 3`이면 표 2. 그 외 다주택 또는 1세대1주택 보유<3년은 표 1. 단계 2에서 종료된 12억 이하 비과세는 본 함수에 도달하지 않음(상위 분기). (b) **표 1** (`appliedDeductionTable = 1`): `holdingRate = tax_rules.findHoldingRate(holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_1)`. `residenceRate = 0`. `totalRate = holdingRate`. `holdingYears < 3`이면 `holdingRate = 0` 반환되며, `appliedDeductionTable = null`로 설정(상위 분기에서 표 1 적용 자격 자체 미충족 케이스 식별용). (c) **표 2** (`appliedDeductionTable = 2`): `holdingRate = tax_rules.findHoldingRate(holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_2_HOLDING)`. `residenceRate = tax_rules.findResidenceRate(residenceYears, holdingYears, tax_rules.LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE)`. `totalRate = holdingRate + residenceRate` (최대 0.80, 룩업 정의상 자동 보장). (d) **공통**: `longTermDeduction = Math.floor(taxableGain × totalRate)`. |
| 절사 | `longTermDeduction`만 floor. 공제율은 비율(절사 없음). |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | `taxableGain < 0` 시 throw (단계 1에서 손실 검출되어야 함). `tax_rules.findHoldingRate`·`findResidenceRate` 미정의 시 §8-2-1 부트스트랩 가드에서 차단. |
| 본문 보유 금지 | 본 함수는 **법령 표·임계 숫자(0.06·0.02·0.04·0.40·0.30·0.08 등)를 직접 보유하지 않는다**. 모든 공제율은 `tax_rules.js`의 룩업 함수 호출로만 획득한다 (명세서 §0-1 원칙 (3)). v0.2.0 초안의 등차수열 산식(`0.06 + (holdingYears − 3) × 0.02` 등)은 **v0.2.1에서 폐기**. |

> **표 2 거주공제율 경계 (2~3년 미만 8%) — 룩업 방식의 자연 처리**: 시행령 제95조 ② 표 2 우측의 "보유기간 3년 이상으로서 거주 2~3년 미만 8%" 단서는 `findResidenceRate(residenceYears, holdingYears, table)` 룩업 함수가 `holdingYears < 3` 시 0 반환으로 처리한다 (룩업 함수 입력에 `holdingYears` 포함). 본 단계 함수는 단서 분기를 직접 다루지 않는다.

> **공제율 합계 80% 상한**: 표 2 룩업은 좌측·우측 모두 최대 행 0.40으로 클램프되므로 `holdingRate + residenceRate ≤ 0.80`이 자동 보장. 별도 `Math.min(0.80, ...)` 가드 불필요하나, 방어적으로 추가해도 무방.

> **v0.1 → v0.2.0 → v0.2.1 진화 정리**:
> - v0.1.1: 본 함수 본문 비활성 (`longTermDeduction = 0` 고정).
> - v0.2.0 초안: 본 함수 본문 활성, **등차수열 산식**으로 표기 (`0.06 + (n − 3) × 0.02` 등).
> - **v0.2.1**: 검증팀 4/30 피드백 반영. **룩업 함수 호출 패턴**으로 정정. 산출 결과는 v0.2.0과 수학적 동치 (TC-006~010 검증 결과 그대로 보존).

### 5-4. 단계 5~13

v0.1.1 모듈 스펙 §5-4 ~ §5-13과 **완전 동일**. 본 문서에서 재정의 없음.

단, 단계 5 양도소득금액 산식은 v0.1.1 그대로:
```
capitalGainIncome = max(0, taxableGain − longTermDeduction)
```
v0.2 단계 4가 0보다 큰 정수를 반환하므로, 단계 5는 자동으로 양수 양도소득금액을 산출한다. 단계 4가 0인 경우(보유<3년)도 v0.1과 동일 동작.

---

## 6. 자체검증 함수 계약

### 6-1. `selfTest()` (v0.2 보강)

| 항목 | v0.1 | v0.2 |
|---|---|---|
| 입력 | 없음 | 동일 |
| 출력 | `{ ok, taxRulesSelfTest, sanityChecks }` | 동일 |
| Sanity 체크 케이스 | TC-001·TC-003·TC-005 (v0.1 골든셋) | + **TC-006 (비과세 totalTax=0)** + **TC-008 (다주택 표 1)** + **TC-010 (일시적 2주택 issueFlag)** 권장 추가 |
| 부수효과 | 없음 (실패해도 throw 안 함) | 동일 |

> v0.1 골든셋 TC-001~005는 v0.2에서 그대로 회귀 통과해야 한다 (명세서 §9). 단 입력 패치(`householdHouseCount: 2` 추가, 명세서 §9-1)가 선행되어야 한다.

### 6-2. `collectIssueFlags(caseData, intermediates)` (v0.2 보강)

`collectIssueFlags`는 자체검증 함수가 아니라 **issueFlag 수집 함수**다. 자체검증과 분리해서 구현한다. 

v0.2에서는 발동 조건이 **18종**으로 확장되었다. 정확한 발동 조건은 명세서 §6 (issueFlag 카탈로그) 참조. 본 문서는 카탈로그를 재정의하지 않는다.

#### 6-2-1. `intermediates` 입력 보강

v0.1에서 단계별 중간값을 `intermediates`로 받아 issueFlag 발동 조건을 평가하던 패턴을 v0.2에서 확장한다. v0.2 신규 필드:

| 필드 | 출처 | 용도 |
|---|---|---|
| `is1Se1House` | 단계 2 | `IS_1SE_1HOUSE`·`POSSIBLE_NON_TAXATION_1H1H`·`HIGH_VALUE_HOUSE`·`IS_HIGH_VALUE_HOUSE` 분기 |
| `isHighValueHouse` | 단계 2/3 | `IS_HIGH_VALUE_HOUSE` 발동 |
| `terminateAt2` | 단계 2 | 발동 분기 보조 (전액 비과세 케이스 식별) |
| `appliedDeductionTable` | 단계 4 | `LONG_TERM_DEDUCTION_TABLE_1`·`_TABLE_2` 발동 |
| `holdingYears`·`residenceYears` | 단계 2 | `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2`·`HOLDING_PERIOD_BOUNDARY`(확장: 2/3/15년 마크 ±3일) |

---

## 7. 불변성 약속 (v0.1 동일)

- 호출자는 `window.TaxOpt.taxEngine`이 노출하는 객체를 변경하지 않는다.
- `calculateSingleTransfer`는 입력 `caseData`를 변경하지 않는다 (검증 대상).
- 13단계 각 함수와 v0.2 신규 보조 함수 3종은 입력값을 변경하지 않는다.
- 본 모듈은 `Object.freeze`를 적용하지 않는다(v0.2). v0.3에서 검토.
- 본 모듈은 DOM에 접근하지 않는다.
- 본 모듈은 외부 라이브러리에 의존하지 않는다.

---

## 8. 의존성

| 의존 | 종류 | v0.2 변경 |
|---|---|---|
| `window.TaxOpt.taxRules` | TaxOpt 모듈 (선행 로드 필수) | **장특공 표 상수 추가 의존** (§8-1) |
| 외부 라이브러리 | 없음 | 동일 |
| DOM | 사용 없음 | 동일 |
| 전역 부수효과 | `window.TaxOpt.taxEngine` 등록만 | 동일 |

### 8-1. tax_rules.js 사용 항목 (v0.2.1 룩업 테이블 정본)

v0.1 사용 항목(`BASIC_DEDUCTION_AMOUNT`·`LOCAL_INCOME_TAX_RATE`·단기세율 2종·`PROGRESSIVE_BRACKETS`·`findBracket`·`RULE_VERSION`·`APPLICABLE_SALE_DATE_FROM`·`LAW_REFS`)은 그대로 유지.

**v0.2.1 정본 (의사결정 #5 강화 — 명세서 §0-1 원칙)**: `tax_rules.js`는 법령 표를 **룩업 테이블 형태로 단일 보유**하고, `tax_engine.js`는 **룩업 함수 호출**로만 공제율을 획득한다. v0.2.0 초안에서 권고했던 "산식 함수 형태"는 폐기.

| 사용 멤버 | 사용 단계 | 형태 (v0.2.1 정본) | 비고 |
|---|---|---|---|
| `HIGH_VALUE_HOUSE_THRESHOLD` | 단계 2·3 (12억 비교) | `number = 1_200_000_000` | 단일 임계 |
| `EXEMPTION_HOLDING_THRESHOLD_YEARS` | 단계 2 (비과세 보유요건) | `number = 2` | 단일 임계 |
| `EXEMPTION_RESIDENCE_THRESHOLD_MONTHS` | 단계 2 (조정대상지역 거주요건) | `number = 24` | 단일 임계 |
| `LONG_TERM_DEDUCTION_TABLE_1` | 단계 4 (표 1) | **`object[]` 룩업 테이블 (13행, 시행령 제95조 ② 표 1 그대로)** | 산식 형태 금지 |
| `LONG_TERM_DEDUCTION_TABLE_2_HOLDING` | 단계 4 (표 2 좌측) | **`object[]` 룩업 테이블 (8행)** | 산식 형태 금지 |
| `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` | 단계 4 (표 2 우측) | **`object[]` 룩업 테이블 (9행, "보유 3년 이상 + 거주 2~3년 미만 8%" 단서 포함)** | 산식 형태 금지 |
| `findHoldingRate(holdingYears, table)` | 단계 4 | **function** (표 1·표 2 좌측 공통) | 룩업 + 클램프 |
| `findResidenceRate(residenceYears, holdingYears, table)` | 단계 4 | **function** (표 2 우측, 단서 단속) | 룩업 + 클램프 |

> **`tax_rules.md` v0.2 갱신본이 본 룩업 테이블·함수의 정확한 데이터 구조를 정의**한다 (5/1 작업지시서 03에서 산출). 본 모듈 스펙은 호출 인터페이스만 규정.

> **단계 4 산출의 단일 정본 (v0.2.1)**: 표 1·표 2의 모든 공제율 숫자는 `tax_rules.js`의 룩업 테이블이 단일 정본이다. `tax_engine.js`는 `findHoldingRate`·`findResidenceRate` 호출 결과를 그대로 사용한다. 검증팀이 손계산 시 사용한 법령 원본 표와 룩업 테이블이 행 단위로 일치하는지 `tests/tax_rules.test.js`에서 검증한다.

> **회귀 테스트 책임 (v0.2.1)**: v0.2.0 초안의 등차수열 산식과 v0.2.1 룩업 결과가 모든 정수 연차에서 일치하는지(특히 보유 3년·15년 경계, 거주 2년·3년·10년 경계) `tests/tax_engine.test.js`가 검증한다. 회귀 통과 기준은 명세서 정답값 그대로 (TC-006~010).

### 8-2. 부트스트랩 가드 (v0.1 동일)

`calculateSingleTransfer`의 진입부에서 다음 가드를 둔다:

```js
if (!window.TaxOpt || !window.TaxOpt.taxRules) {
  throw new Error('tax_engine: tax_rules.js가 먼저 로드되어야 합니다.');
}
```

`<script>` 로드 순서가 잘못되었을 때 실패를 명시적으로 표면화하기 위함이다.

#### 8-2-1. v0.2 추가 가드

장특공 표 상수가 `tax_rules.js`에 누락된 경우(v0.1 룰만 로드된 경우)도 동일하게 명시적으로 차단:

```js
if (typeof window.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') {
  throw new Error('tax_engine v0.2: tax_rules v0.2 (장특공 표·12억 임계 등) 미로드.');
}
```

`tax_rules.js`가 v0.1 상태로 남고 `tax_engine.js`만 v0.2로 갱신된 경우의 silent failure를 방지한다.

---

## 9. 비책임 (out of scope, v0.1 베이스 + v0.2 추가)

본 모듈은 다음을 **수행하지 않습니다**. 모두 다른 모듈의 책임입니다.

| 영역 | 책임 위치 |
|---|---|
| 입력값 UI 수집 | `js/input_collector.js` (v0.3 예정) |
| 결과 화면 렌더링 | `result.html` |
| 시나리오 비교 (양도 전·후 자산 구성) | `js/scenario_engine.js` (v0.3 예정) |
| 다주택 중과 (제104조 ⑦) | v0.3 |
| 일시적 2주택 정확 산정 | v0.3 |
| 장기임대주택 특례 (제155조 등) | v0.6+ |
| 부담부증여·상속·증여 취득 산정 | 제외 (PRD 1.1) |
| 미등기양도자산 70% 세율 | 제외 (PRD 1.1, issueFlag만) |

---

## 10. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1.1 | 2026-04-29 | 초판. 작업 창 #4 산출. 13단계 파이프라인 본문 확정 |
| v0.2.0 | 2026-04-30 | 본 버전. 작업 창 #6 산출. (1) 노출 멤버 3종 신규: `check1Se1HouseExemption`·`calculateHighValuePortion`·`calculateLongTermDeduction`. (2) v0.1 함수 시그니처 유지, 단계 2·3·4 본문 활성. (3) `result.steps`에 v0.2 신규 필드 10종 추가. (4) `terminateAt2=true` 시 후속 단계값 명시 0/null 정책 추가. (5) `tax_rules.js` 의존 6종 추가 (12억 임계·장특공 표 1·표 2 보유·표 2 거주·비과세 보유·비과세 거주 임계). (6) issueFlag 카탈로그 18종 (명세서 §6 참조). |
| v0.2.1 | 2026-05-01 | (1) **TC-006~010 검증팀 손계산 + 홈택스 모의계산 3자 일치 확정 (KPI 100%)**. 메타 표 검증 완료 마크 + 골든셋 v0.2.1 참조 갱신. (2) **`calculateLongTermDeduction` 함수 계약 룩업 호출 패턴으로 정정** (검증팀 4/30 피드백, 명세서 §0-1 법령 개정 대응 아키텍처). v0.2.0의 등차수열 산식 표기(`0.06 + (n−3) × 0.02`, `n × 0.04` 등) 폐기. 본 함수는 `tax_rules.findHoldingRate`·`findResidenceRate` 호출만 담당, 법령 숫자 직접 보유 금지. (3) **§8-1 의존성 표 정본 확정**: `tax_rules.js`의 장특공 표 3종은 **룩업 테이블 형태로 단일 보유**, `findHoldingRate`·`findResidenceRate` 룩업 함수 호출 패턴 정본. v0.2.0의 "배열 vs 함수" 양쪽 허용 권고 폐기. (4) **§11-1 보류 항목 해소**. (5) `selfTest` sanity 케이스(§11-2)·`Object.freeze`(§11-3)·`HOLDING_PERIOD_BOUNDARY` 일자 단위(§11-4)·`UNREGISTERED_ASSET_ASSUMED_FALSE` 이름(§11-5)는 그대로 유지(작업지시서 03/04에서 결정). |

---

## 11. 검증 후 보류 항목

본 모듈 스펙은 다음 항목을 **명세서 검증 완료 후에 확정**한다.

1. ~~**`tax_rules.js` v0.2의 노출 형태 (배열 vs 함수)**~~ → **v0.2.1에서 해소**: **룩업 테이블 + 룩업 함수(`findHoldingRate`·`findResidenceRate`)** 정본 확정 (의사결정 #5 강화, 명세서 §0-1, §8-1).
2. **`selfTest()` sanity 케이스 추가 (TC-006·008·010)**: 부트스트랩 부담 검토 후 채택 여부 결정. 일단 권장으로 표기. (5/1 작업지시서 04에서 결정)
3. **`Object.freeze` 적용 여부**: v0.3 시나리오 엔진 도입 시 모듈 격리 요구 여부에 따라 결정. (v0.3 검토)
4. **`HOLDING_PERIOD_BOUNDARY` 확장 임계치 (2년·3년·15년 ±3일)**: 명세서 §6-3 확장은 확정. 본 모듈 스펙은 `collectIssueFlags`의 입력 `intermediates`에 `holdingYears` 추가만 명시. 정수 임계 외에 일자 단위 임계도 필요한지(±3일은 일자 기준)는 검증팀 의견 수렴 후 결정. (5/1 작업지시서 04에서 결정)
5. **`UNREGISTERED_ASSET_ASSUMED_FALSE` → `UNREGISTERED_RATE_NOT_APPLIED` 이름 변경**: 명세서 §6-2 권고. 본 모듈 스펙은 새 이름을 채택하나, 결정 미확정 시 v0.1 이름 그대로 유지 가능. (5/1 작업지시서 04에서 결정)

---

(끝)
