# TaxOpt 테스트 케이스 v0.2.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.2/06_test_cases.md` |
| 버전 | v0.2.1 (검증 통과 + 산식 표기 정정) |
| 상태 | ✅ **검증 완료** (검증팀 손계산 + 홈택스 모의계산 3자 일치, 2026-04-30, KPI 100%) |
| 검증 방식 | 검증팀 손계산(설하영·이준기·김태환·김두섭) + 국세청 홈택스 모의계산 3자 일치 |
| 검증 결과 (totalTax) | TC-006: 0 ✅ / TC-007: 6,161,100 ✅ / TC-008: 130,878,000 ✅ / TC-009: 1,383,642 ✅ / TC-010: 122,826,000 ✅ |
| 작성일 | 2026-04-30 (v0.2.0 초안) → 2026-05-01 (v0.2.1 정정) |
| 관련 문서 | `docs/v0.2/01_calc_engine_spec.md` v0.2.1, `docs/v0.2/03_input_schema.md` v0.2.0, `docs/v0.2/modules/tax_engine.md` v0.2.1 |

---

## 0. 골든셋의 의미

본 5개 테스트 케이스(TC-006~010)는 v0.2 활성판(1세대1주택 비과세·고가주택 안분·장특공 표 1·표 2)의 검증을 위해 작성. v0.1 골든셋 TC-001~005와 합쳐 v0.2 코드 회귀 검증 베이스라인을 구성.

**검증 결과 (2026-04-30)**: 5건 모두 검증팀 손계산·홈택스 모의계산과 3자 일치. KPI 100% 달성. 명세서 v0.2.0 → v0.2.1 검증 통과 확정.

> **v0.2.1 정정**: 본 골든셋의 단계별 기대값 표 중 **장특공 공제율 산정 근거 표기**가 등차수열 산식(예: `0.06 + (12−3) × 0.02`)에서 **법령 표 룩업 형태**(예: "표 1 룩업: 12년 → 24%")로 통일되었다 (검증팀 4/30 피드백 반영, 명세서 §0-1 법령 개정 대응 아키텍처 원칙). 각 케이스의 산출값(taxableGain·longTermDeduction·totalTax 등) 정답값은 **모두 변경 없음**.

---

## 1. v0.1 골든셋 회귀 (TC-001~005, 입력 패치 필수)

`docs/v0.1/06_test_cases.md` v0.1.1 5건 그대로 통과해야 한다.

**필수 입력 패치 (v0.1.2)**: TC-001~005 모든 케이스의 입력에 다음 4개 필드 명시 추가 (명세서 v0.2.0 §9-1, 입력 스키마 v0.2.0 §5-3):

```js
// 모든 v0.1 골든셋 입력에 추가
householdHouseCount: 2,         // ← 비과세 회피 (다주택)
isOneTimeTwoHouses:  false,
acquisitionRegulated: false,    // (이미 false였으면 명시 유지)
residenceMonths: 0              // (TC-001~005는 거주기간 미사용)
```

> 패치 없이도 자동 보정으로 `householdHouseCount = 1`이 되어 비과세 분기 진입할 위험. 이는 v0.1 정답값(예: TC-001 totalTax 98,241,000)과 충돌. 입력 패치로 해결.

> 본 패치는 v0.2 검증 작업의 부수 산출물로 별도 작업지시서 또는 Claude Code 직접 패치로 처리 예정.

---

## 2. v0.2 케이스 일람 (TC-006~010)

| ID | 검증 의도 | 1세대1주택 | salePrice | 보유 | 거주 | 적용 산식 | 기대 totalTax |
|---|---|---|---|---|---|---|---|
| TC-006 | 1세대1주택 비과세 + 12억 이하 (전액 비과세) | YES | 10억 | 5년 | 5년 | 단계 2 종료 | **0** |
| TC-007 | 1세대1주택 + 12억 초과 (안분 + 표 2 64%) | YES | 15억 | 8년 | 8년 | 안분 0.2 + 표 2 (32%+32%=64%) | 검증팀 |
| TC-008 | 다주택 일반과세 + 표 1 (보유 12년 → 24%) | NO | 10억 | 12년 | — | 표 1 24% | 검증팀 |
| TC-009 | 1세대1주택 + 표 2 최대 80% (안분 + 0% 과세) | YES | **14억** | 10년 | 10년 | 안분 (14억-12억)/14억 + 표 2 (40%+40%=80%) | 검증팀 |
| TC-010 | 일시적 2주택 (적용 안 함, 다주택 일반과세) | NO | 10억 | 5년 | — | 표 1 10% + ONE_TIME_2HOUSES_NOT_APPLIED | 검증팀 |

> ⚠️ **TC-009 변경 사항 — 작업지시서 vs 본 명세서**: 작업지시서 원안은 `salePrice = 11억(12억 이하 비과세) + 표 2 최대 80%, 기대 totalTax = 0`이었으나 **모순**(12억 이하면 단계 2 종료라 표 2 미적용). 본 명세서는 **`salePrice = 14억`으로 변경**하여 안분 + 표 2 80% 분기를 동시에 검증한다.

---

## 3. TC-006 — 1세대1주택 비과세 + 12억 이하 (전액 비과세)

### 3-1. 입력

| 필드 | 값 |
|---|---|
| `baseYear` | 2026 |
| `householdMembers` | 2 |
| `basicDeductionUsed` | false |
| **`householdHouseCount`** | **1** |
| **`isOneTimeTwoHouses`** | **false** |
| `houses[0].id` | "A" |
| `houses[0].acquisitionDate` | 2021-04-30 |
| `houses[0].acquisitionPrice` | 600,000,000 |
| `houses[0].necessaryExpense` | 15,000,000 |
| **`houses[0].acquisitionRegulated`** | **false** (비조정대상지역 취득 → 거주요건 면제) |
| **`houses[0].residenceMonths`** | **60** (5년) |
| `houses[0].livingNow` | true |
| `houses[0].expectedSaleDate` | 2026-08-31 |
| `houses[0].expectedSalePrice` | **1,000,000,000** (10억, 12억 이하) |
| `houses[0].saleRegulated` | false |

### 3-2. 단계별 기대값

| 단계 | 변수 | 기대값 |
|---|---|---|
| 1 | `transferGain` | 385,000,000 (= 1,000,000,000 − 600,000,000 − 15,000,000) |
| 2 | `is1Se1House` | **true** |
|   | `terminateAt2` | **true** (단계 2 종료) |
|   | `holdingYears` | 5 |
|   | `residenceYears` | 5 |
|   | `taxableGain` | 0 (단계 2 종료 시 명시 0) |
| 3~12 | (스킵) | 0 |
| 13 | `netAfterTaxSaleAmount` | **1,000,000,000** (= salePrice − 0) |
|   | `totalTax` | **0** ✅ |

> ✅ **검증 완료 (2026-04-30)**: 검증팀 손계산·홈택스 모의계산과 3자 일치. 담당: 설하영. (단계 2 종료, 후속 단계 0/null 일관성 검증 완료.)

### 3-3. 산식 검산

```
보유: 2021-04-30 → 2026-08-31 = 5년 4개월 (≥ 2년 ✅)
취득시 비조정대상지역 → 거주요건 면제 ✅
1세대1주택 (householdHouseCount=1) ✅
salePrice = 10억 < 12억 → 단계 2 종료, 전액 비과세
totalTax = 0
```

### 3-4. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| `IS_1SE_1HOUSE` | info | ✅ |
| `LONG_TERM_DEDUCTION_TABLE_2` | info | ❌ (단계 4 호출 안 됨) |
| `RESIDENCE_MONTHS_USER_INPUT` | info | ✅ |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | ✅ |
| `UNREGISTERED_RATE_NOT_APPLIED` | info | ✅ |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | ✅ |

---

## 4. TC-007 — 1세대1주택 + 12억 초과 (안분 + 표 2 64%)

### 4-1. 입력

| 필드 | 값 |
|---|---|
| `baseYear` | 2026 |
| `basicDeductionUsed` | false |
| **`householdHouseCount`** | **1** |
| `isOneTimeTwoHouses` | false |
| `houses[0].acquisitionDate` | 2018-06-15 |
| `houses[0].acquisitionPrice` | 800,000,000 |
| `houses[0].necessaryExpense` | 30,000,000 |
| **`houses[0].acquisitionRegulated`** | **false** |
| **`houses[0].residenceMonths`** | **96** (8년) |
| `houses[0].expectedSaleDate` | 2026-09-30 |
| `houses[0].expectedSalePrice` | **1,500,000,000** (15억) |
| `houses[0].saleRegulated` | false |

### 4-2. 단계별 기대값

| 단계 | 변수 | 기대값 | 산식 |
|---|---|---|---|
| 1 | `transferGain` | 670,000,000 | 1,500,000,000 − 800,000,000 − 30,000,000 |
| 2 | `is1Se1House` | true | 보유 8.3년 ≥ 2, 비조정 |
|   | `isHighValueHouse` | true | salePrice ≥ 12억 |
|   | `terminateAt2` | false | 단계 3 진입 |
| 3 | `allocationRatio` | 0.2 | (1,500,000,000 − 1,200,000,000) / 1,500,000,000 |
|   | `taxableGain` (안분 후) | **134,000,000** | Math.floor(670,000,000 × 0.2) |
| 4 | `holdingYears` | 8 | 동월동일 비교 |
|   | `residenceYears` | 8 | floor(96/12) |
|   | `holdingRate` (표 2) | 0.32 | 표 2 좌측 룩업: 보유 8년 → 32% |
|   | `residenceRate` (표 2) | 0.32 | 표 2 우측 룩업: 거주 8년 → 32% (보유 3년 이상 충족) |
|   | `totalRate` | 0.64 | 0.32 + 0.32 |
|   | `appliedDeductionTable` | 2 | |
|   | `longTermDeduction` | **85,760,000** | Math.floor(134,000,000 × 0.64) |
| 5 | `capitalGainIncome` | 48,240,000 | 134,000,000 − 85,760,000 |
| 6 | `basicDeduction` | 2,500,000 | basicDeductionUsed=false |
| 7 | `taxBase` | 45,740,000 | 48,240,000 − 2,500,000 |
| 8 | `holdingPeriodBranch` | "over2y" | 보유 8.3년 |
| 9 | `appliedRate` | 기본세율 1,400만 초과~5,000만 이하 (15%) | taxBase ∈ (14M, 50M] |
| 10 | `calculatedTax` | **5,601,000** ✅ | 840,000 + (45,740,000 − 14,000,000) × 0.15 = 840,000 + 4,761,000 (검증 완료) |
| 11 | `localIncomeTax` | **560,100** ✅ | floor(5,601,000 × 0.1) (검증 완료) |
| 12 | `totalTax` | **6,161,100** ✅ | (검증 완료, 3자 일치) |
| 13 | `netAfterTaxSaleAmount` | **1,493,838,900** ✅ | 1,500,000,000 − 6,161,100 (검증 완료) |

> ✅ **검증 완료 (2026-04-30)**: 검증팀 손계산·홈택스 모의계산과 3자 일치. 담당: 이준기.

### 4-3. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| `IS_1SE_1HOUSE` | info | ✅ |
| `IS_HIGH_VALUE_HOUSE` | info | ✅ (안분비율 20%) |
| `LONG_TERM_DEDUCTION_TABLE_2` | info | ✅ (보유 32% + 거주 32% = 64%) |
| `RESIDENCE_MONTHS_USER_INPUT` | info | ✅ |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | ✅ |
| `UNREGISTERED_RATE_NOT_APPLIED` | info | ✅ |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | ✅ |

---

## 5. TC-008 — 다주택 일반과세 + 표 1 (보유 12년 → 24%)

### 5-1. 입력

| 필드 | 값 |
|---|---|
| `baseYear` | 2026 |
| `basicDeductionUsed` | false |
| **`householdHouseCount`** | **2** (다주택, 비과세 미적용) |
| `isOneTimeTwoHouses` | false |
| `houses[0].acquisitionDate` | 2014-05-20 |
| `houses[0].acquisitionPrice` | 500,000,000 |
| `houses[0].necessaryExpense` | 20,000,000 |
| `houses[0].acquisitionRegulated` | false |
| `houses[0].residenceMonths` | 0 (거주 안 함) |
| `houses[0].expectedSaleDate` | 2026-08-15 |
| `houses[0].expectedSalePrice` | **1,000,000,000** (10억) |
| `houses[0].saleRegulated` | false |

### 5-2. 단계별 기대값

| 단계 | 변수 | 기대값 | 산식 |
|---|---|---|---|
| 1 | `transferGain` | 480,000,000 | 1,000,000,000 − 500,000,000 − 20,000,000 |
| 2 | `is1Se1House` | false | householdHouseCount=2 |
|   | `taxableGain` | 480,000,000 | passthrough |
| 3 | `taxableGain` | 480,000,000 | 안분 미적용 |
| 4 | `holdingYears` | 12 | 2014-05-20 → 2026-08-15 |
|   | `appliedDeductionTable` | 1 | |
|   | `holdingRate` (표 1) | 0.24 | 표 1 룩업: 보유 12년 → 24% |
|   | `longTermDeduction` | **115,200,000** | Math.floor(480,000,000 × 0.24) |
| 5 | `capitalGainIncome` | 364,800,000 | 480,000,000 − 115,200,000 |
| 6 | `basicDeduction` | 2,500,000 | |
| 7 | `taxBase` | 362,300,000 | |
| 8 | `holdingPeriodBranch` | "over2y" | |
| 9 | `appliedRate` | 기본세율 3억~5억 이하 (40%) | taxBase ∈ (3억, 5억] |
| 10 | `calculatedTax` | **118,980,000** ✅ | 94,060,000 + (362,300,000 − 300,000,000) × 0.40 = 94,060,000 + 24,920,000 (검증 완료) |
| 11 | `localIncomeTax` | **11,898,000** ✅ | floor(118,980,000 × 0.1) (검증 완료) |
| 12 | `totalTax` | **130,878,000** ✅ | (검증 완료, 3자 일치) |
| 13 | `netAfterTaxSaleAmount` | **869,122,000** ✅ | 1,000,000,000 − 130,878,000 (검증 완료) |

> ✅ **검증 완료 (2026-04-30)**: 검증팀 손계산·홈택스 모의계산과 3자 일치. 담당: 김태환.

### 5-3. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| `LONG_TERM_DEDUCTION_TABLE_1` | info | ✅ (보유 12년 → 24%) |
| `RESIDENCE_MONTHS_USER_INPUT` | info | ✅ |
| `RESIDENCE_MONTHS_DEFAULTED_ZERO` | info | ❌ (명시 입력함) |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | ✅ |
| `UNREGISTERED_RATE_NOT_APPLIED` | info | ✅ |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | ✅ |

---

## 6. TC-009 — 1세대1주택 + 표 2 최대 80% (안분 + 0% 과세표준)

> **주의 — 작업지시서 원안과 차이**: 원안은 salePrice = 11억(비과세) + 표 2 80% 검증이었으나 모순. 본 케이스는 **salePrice = 14억으로 변경**하여 안분 + 표 2 80% 동시 검증.

### 6-1. 입력

| 필드 | 값 |
|---|---|
| `baseYear` | 2026 |
| `basicDeductionUsed` | false |
| **`householdHouseCount`** | **1** |
| `isOneTimeTwoHouses` | false |
| `houses[0].acquisitionDate` | 2016-04-30 |
| `houses[0].acquisitionPrice` | 700,000,000 |
| `houses[0].necessaryExpense` | 25,000,000 |
| **`houses[0].acquisitionRegulated`** | **false** |
| **`houses[0].residenceMonths`** | **120** (10년) |
| `houses[0].expectedSaleDate` | 2026-09-15 |
| `houses[0].expectedSalePrice` | **1,400,000,000** (14억) |
| `houses[0].saleRegulated` | false |

### 6-2. 단계별 기대값

| 단계 | 변수 | 기대값 | 산식 |
|---|---|---|---|
| 1 | `transferGain` | 675,000,000 | 1,400,000,000 − 700,000,000 − 25,000,000 |
| 2 | `is1Se1House` | true | |
|   | `isHighValueHouse` | true | |
| 3 | `allocationRatio` | ≈ 0.142857142857… | (1,400,000,000 − 1,200,000,000) / 1,400,000,000 = 1/7 |
|   | `taxableGain` (안분 후) | **96,428,571** | Math.floor(675,000,000 × 1/7) = Math.floor(96,428,571.428…) |
| 4 | `holdingYears` | 10 | |
|   | `residenceYears` | 10 | |
|   | `holdingRate` (표 2) | 0.40 | 표 2 좌측 룩업: 보유 10년 이상 → 40% (최대 행 클램프) |
|   | `residenceRate` (표 2) | 0.40 | 표 2 우측 룩업: 거주 10년 이상 → 40% (최대 행 클램프) |
|   | `totalRate` | 0.80 | (산식상 자동 상한 80%) |
|   | `appliedDeductionTable` | 2 | |
|   | `longTermDeduction` | **77,142,856** | Math.floor(96,428,571 × 0.80) |
| 5 | `capitalGainIncome` | 19,285,715 | 96,428,571 − 77,142,856 |
| 6 | `basicDeduction` | 2,500,000 | |
| 7 | `taxBase` | 16,785,715 | |
| 8 | `holdingPeriodBranch` | "over2y" | |
| 9 | `appliedRate` | 기본세율 1,400만 초과~5,000만 이하 (15%) | |
| 10 | `calculatedTax` | **1,257,857** ✅ | 840,000 + (16,785,715 − 14,000,000) × 0.15 = 840,000 + 417,857 (검증 완료) |
| 11 | `localIncomeTax` | **125,785** ✅ | floor(1,257,857 × 0.1) (검증 완료) |
| 12 | `totalTax` | **1,383,642** ✅ | (검증 완료, 3자 일치) |
| 13 | `netAfterTaxSaleAmount` | **1,398,616,358** ✅ | 1,400,000,000 − 1,383,642 (검증 완료) |

> ✅ **검증 완료 (2026-04-30)**: 검증팀 손계산·홈택스 모의계산과 3자 일치. 담당: 김두섭. (TC-009는 v0.2.0 초안 작성 시 salePrice 11억 → 14억 변경 케이스. 표 2 80% 클램프 검증 목적.)

### 6-3. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| `IS_1SE_1HOUSE` | info | ✅ |
| `IS_HIGH_VALUE_HOUSE` | info | ✅ (안분비율 14.29%) |
| `LONG_TERM_DEDUCTION_TABLE_2` | info | ✅ (보유 40% + 거주 40% = 80% 최대) |
| `RESIDENCE_MONTHS_USER_INPUT` | info | ✅ |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | ✅ |
| `UNREGISTERED_RATE_NOT_APPLIED` | info | ✅ |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | ✅ |

---

## 7. TC-010 — 일시적 2주택 (적용 안 함, 다주택 일반과세)

### 7-1. 입력

| 필드 | 값 |
|---|---|
| `baseYear` | 2026 |
| `basicDeductionUsed` | false |
| **`householdHouseCount`** | **2** |
| **`isOneTimeTwoHouses`** | **true** ⚠️ (입력 시 issueFlag 발동, 산식 분기 없음) |
| `houses[0].acquisitionDate` | 2021-05-20 |
| `houses[0].acquisitionPrice` | 600,000,000 |
| `houses[0].necessaryExpense` | 15,000,000 |
| `houses[0].acquisitionRegulated` | false |
| `houses[0].residenceMonths` | 0 |
| `houses[0].expectedSaleDate` | 2026-08-31 |
| `houses[0].expectedSalePrice` | **1,000,000,000** (10억) |
| `houses[0].saleRegulated` | false |

### 7-2. 단계별 기대값

| 단계 | 변수 | 기대값 | 산식 |
|---|---|---|---|
| 1 | `transferGain` | 385,000,000 | 1,000,000,000 − 600,000,000 − 15,000,000 |
| 2 | `is1Se1House` | false | householdHouseCount=2 |
|   | `taxableGain` | 385,000,000 | |
| 3 | `taxableGain` | 385,000,000 | 안분 미적용 |
| 4 | `holdingYears` | 5 | 2021-05-20 → 2026-08-31 |
|   | `appliedDeductionTable` | 1 | |
|   | `holdingRate` (표 1) | 0.10 | 표 1 룩업: 보유 5년 → 10% |
|   | `longTermDeduction` | **38,500,000** | Math.floor(385,000,000 × 0.10) |
| 5 | `capitalGainIncome` | 346,500,000 | 385,000,000 − 38,500,000 |
| 6 | `basicDeduction` | 2,500,000 | |
| 7 | `taxBase` | 344,000,000 | |
| 8 | `holdingPeriodBranch` | "over2y" | |
| 9 | `appliedRate` | 기본세율 3억~5억 이하 (40%) | |
| 10 | `calculatedTax` | **111,660,000** ✅ | 94,060,000 + (344,000,000 − 300,000,000) × 0.40 = 94,060,000 + 17,600,000 (검증 완료) |
| 11 | `localIncomeTax` | **11,166,000** ✅ | floor(111,660,000 × 0.1) (검증 완료) |
| 12 | `totalTax` | **122,826,000** ✅ | (검증 완료, 3자 일치) |
| 13 | `netAfterTaxSaleAmount` | **877,174,000** ✅ | 1,000,000,000 − 122,826,000 (검증 완료) |

> ✅ **검증 완료 (2026-04-30)**: 검증팀 손계산·홈택스 모의계산과 3자 일치. 담당: 설하영(겸).

### 7-3. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| **`ONE_TIME_2HOUSES_NOT_APPLIED`** | **warning** | **✅** (isOneTimeTwoHouses=true) |
| `LONG_TERM_DEDUCTION_TABLE_1` | info | ✅ (보유 5년 → 10%) |
| `RESIDENCE_MONTHS_USER_INPUT` | info | ✅ |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | ✅ |
| `UNREGISTERED_RATE_NOT_APPLIED` | info | ✅ |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | ✅ |

### 7-4. 검증 의도

- `isOneTimeTwoHouses === true` 입력 → `ONE_TIME_2HOUSES_NOT_APPLIED` warning 발동만 검증
- 산식 분기 없음 → 다주택 일반과세 (표 1 적용) 그대로
- v0.3 또는 v0.5에서 시행령 제155조 ① 본격 처리 시 본 케이스의 totalTax는 0이 될 예정 (1세대1주택 비과세 적용 분기)

---

## 8. 검증 결과 종합 (2026-04-30 확정, KPI 100%)

| TC | 검증팀 손계산 | Claude 명세서 산출 | 홈택스 모의계산 | 결과 |
|---|---|---|---|---|
| TC-006 | 0 | 0 | 0 | ✅ 3자 일치 |
| TC-007 | 6,161,100 | 6,161,100 | 6,161,100 | ✅ 3자 일치 |
| TC-008 | 130,878,000 | 130,878,000 | 130,878,000 | ✅ 3자 일치 |
| TC-009 | 1,383,642 | 1,383,642 | 1,383,642 | ✅ 3자 일치 |
| TC-010 | 122,826,000 | 122,826,000 | 122,826,000 | ✅ 3자 일치 |

(totalTax 기준 비교, 전체 단계별 중간값 + issueFlag 발동 검증도 모두 일치 확인)

---

## 9. v0.3 회귀 검증 원칙

v0.3 다주택 중과 적용 시:

- TC-006·007·009 (1세대1주택 비과세 케이스): 결과 변경 없음(중과 적용 안 됨).
- TC-008 (다주택 + 보유 12년): `saleRegulated=false`이므로 중과 미적용, 결과 변경 없음.
- TC-010 (일시적 2주택 + 다주택): v0.3 또는 v0.5에서 일시적 2주택 본격 처리 시 비과세 분기 진입 → totalTax 0으로 변경 가능. 본 케이스는 v0.3 시점에 산식 변경됨을 명시.

---

## 10. 자동 테스트 변환 가이드

`tests/tax_engine.test.js`에 다음 형태로 변환 (v0.1.1 §8 패턴 그대로):

```js
const TC_GOLDEN_V02 = [
  {
    id: "TC-006",
    intent: "1세대1주택 비과세 + 12억 이하 (전액 비과세)",
    input: {
      baseYear: 2026,
      basicDeductionUsed: false,
      householdHouseCount: 1,
      isOneTimeTwoHouses: false,
      houses: [{
        id: "A",
        acquisitionDate: "2021-04-30",
        acquisitionPrice: 600_000_000,
        necessaryExpense: 15_000_000,
        acquisitionRegulated: false,
        residenceMonths: 60,
        livingNow: true,
        expectedSaleDate: "2026-08-31",
        expectedSalePrice: 1_000_000_000,
        saleRegulated: false
      }],
      salePlan: { candidateHouseIds: ["A"] }
    },
    expected: {
      transferGain:          385_000_000,
      taxableGain:                     0,    // 단계 2 종료
      is1Se1House:                  true,
      isHighValueHouse:            false,
      terminateAt2:                 true,
      holdingYears:                    5,
      residenceYears:                  5,
      longTermDeduction:               0,
      appliedDeductionTable:        null,
      capitalGainIncome:               0,
      basicDeduction:                  0,    // 단계 2 종료 시 기본공제도 0 처리
      taxBase:                         0,
      calculatedTax:                   0,
      localIncomeTax:                  0,
      totalTax:                        0,
      netAfterTaxSaleAmount: 1_000_000_000
    },
    expectedIssueFlags: ["IS_1SE_1HOUSE", "RESIDENCE_MONTHS_USER_INPUT",
                         "NECESSARY_EXPENSE_BREAKDOWN_MISSING",
                         "UNREGISTERED_RATE_NOT_APPLIED",
                         "ACQUISITION_CAUSE_ASSUMED_PURCHASE"]
  },
  // TC-007 ~ TC-010 동일 패턴
];
```

상세 구현은 v0.2 코드 작업지시서(`docs/05_code_work_orders/04_tax_engine_v0_2.md` 예정)에서 확정.

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.0 | 2026-04-26 | TC-001~005 초기 작성 |
| v0.1.1 | 2026-04-28 | TC-001~005 검증팀 + 홈택스 3자 일치 확정 |
| v0.2.0 | 2026-04-30 | **TC-006~010 신규 5건 추가** (비과세, 안분, 표 2, 표 1, 일시적 2주택). v0.1 골든셋 입력 패치(`householdHouseCount: 2`) 권고. **TC-009 작업지시서 원안 모순 정정** (11억 → 14억). 검증팀 손계산 의뢰 대기. |
| v0.2.1 | 2026-05-01 | (1) **TC-006~010 검증팀 손계산 + 홈택스 모의계산 3자 일치 확정 (KPI 100%)**. §8 검증 결과 매트릭스 채움. 각 TC별 검증 완료 마크 (담당자 명시). 결과(totalTax 5건) 변경 없음. (2) **장특공 산식 표기 룩업 테이블로 통일** (검증팀 4/30 피드백 반영, 명세서 §0-1 법령 개정 대응 아키텍처). TC-007 표 2 `8 × 0.04` → "표 2 룩업: 보유 8년 → 32% / 거주 8년 → 32%". TC-008 표 1 `0.06 + (12-3) × 0.02` → "표 1 룩업: 보유 12년 → 24%". TC-009 표 2 "10년 이상 클램프" → "표 2 좌측·우측 룩업: 10년 이상 → 40% (최대 행 클램프)". TC-010 표 1 `0.06 + (5-3) × 0.02` → "표 1 룩업: 보유 5년 → 10%". TC-006은 단계 4 호출 없음(영향 없음). |
