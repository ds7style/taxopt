# TaxOpt 입력 스키마 v0.2.0 (초안)

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.2/03_input_schema.md` |
| 버전 | v0.2.0 (초안) |
| 상태 | ⏳ **검증 대기** |
| 작성일 | 2026-04-30 |
| 관련 문서 | `docs/v0.2/01_calc_engine_spec.md`, `docs/99_decision_log.md` (의사결정 #10) |
| 다음 버전 | v0.3 (다주택 중과·시나리오 엔진), v0.6+ (조특법 특례주택 활성) |

---

## 0. 문서 위치

본 문서는 v0.1.2 입력 스키마(의사결정 #10 패치 반영)를 토대로 v0.2 활성 필드를 추가하고 자동 보정 룰을 확정한다. v0.1.2 본문은 그대로 유지하며, **v0.2는 (a) 기존 보존 필드 활성화 (b) 신규 필드 2개 추가 (c) 자동 보정 룰 확장**의 3가지를 변경한다.

---

## 1. caseData 최상위 구조 (v0.2)

```js
caseData = {
  baseYear:           number,
  householdMembers:   number,
  basicDeductionUsed: boolean,
  houses:             House[],
  salePlan:           SalePlan
}
```

> v0.2에서도 `houses` 배열은 1개만 사용 (`salePlan.candidateHouseIds.length === 1`). 다주택 시나리오 엔진은 v0.3.

---

## 2. House 스키마 (v0.2)

```js
House = {
  // ─── 식별 (v0.1.1 그대로) ───
  id:                     "A" | "B" | "C",
  nickname:               string,
  location:               string,

  // ─── 취득 (v0.1.1 그대로) ───
  acquisitionDate:        "YYYY-MM-DD",
  acquisitionPrice:       number,
  necessaryExpense:       number,
  acquisitionRegulated:   boolean,        // v0.2 활성 — 거주요건 판정용

  // ─── 거주 (v0.1.1 보존 → v0.2 활성) ───
  residenceMonths:        number,         // v0.2 활성 — 비과세 거주요건 + 표 2 거주공제율
  livingNow:              boolean,        // v0.2 활성 — 보존 (현행 거주 표시용)

  // ─── 양도 (v0.1.1 그대로) ───
  expectedSaleDate:       "YYYY-MM-DD",
  expectedSalePrice:      number,
  saleRegulated:          boolean,        // v0.2 보존 (양도시 조정대상지역, 다주택 중과 v0.3)

  // ─── v0.6+ 조특법 특례주택 확장 (의사결정 #10 보강 4, v0.1.2 추가) ───
  specialTaxFlags:             SpecialTaxFlags,
  specialTaxRequirementsMet:   string[]
}

SpecialTaxFlags = {
  isFarmHouse:                  boolean,
  isHometownHouse:              boolean,
  isPopulationDeclineAreaHouse: boolean,
  isLongTermRental:             boolean
}
```

### 2-1. v0.2에서 신규 활성화되는 House 필드 (v0.1.1 보존 → v0.2 활성)

| 필드 | 활성 단계 | 사용처 |
|---|---|---|
| `acquisitionRegulated` | 단계 2 | 비과세 거주요건 분기 (취득시 조정대상지역이면 거주 ≥ 24M 필요) |
| `residenceMonths` | 단계 2, 단계 4 | 비과세 거주요건(≥ 24) + 표 2 거주공제율 산출 |
| `livingNow` | (v0.2 보존) | 결과 화면 표시. 산식 입력 아님. |

> v0.1에서 보존만 했던 3개 필드가 v0.2에서 본격 사용된다. 다만 화면(`index.html`)의 입력 컴포넌트는 v0.1 단계에서 이미 추가되어 있으므로 화면 변경 불필요.

### 2-2. v0.2에서 활성 유지되는 v0.1 필드

| 필드 | v0.1 사용 | v0.2 사용 |
|---|---|---|
| `acquisitionDate` | 보유기간 | 비과세 보유요건 + 표 1·2 보유공제율 |
| `acquisitionPrice` | 양도차익 | 동일 |
| `necessaryExpense` | 양도차익 | 동일 |
| `expectedSaleDate` | 보유기간 + 시점 검증 | 동일 + 표 1·2 보유연차 |
| `expectedSalePrice` | 양도차익 + 세후 매각금액 | 동일 + 12억 비교 + 안분비율 |

### 2-3. v0.2 미사용 필드 (보존만)

| 필드 | 보존 이유 |
|---|---|
| `saleRegulated` | v0.3 다주택 중과 판정용 (양도시 조정대상지역) |
| `nickname`, `location` | 결과 화면 표시 |
| `livingNow` | 결과 화면 표시 |
| `specialTaxFlags` | v0.6+ 조특법 특례주택 |
| `specialTaxRequirementsMet` | v0.6+ 조특법 특례 요건 자기보고 |

### 2-4. v0.6+ 확장 대비 필드 (v0.2 미입력 처리, v0.1.2 패치 그대로)

`specialTaxFlags`와 `specialTaxRequirementsMet`은 v0.2까지 입력 화면 비노출. 자동 보정값 v0.1.2 패치 그대로:

| 필드 | v0.2 누락 시 자동 보정값 | v0.6+ 활성 시 처리 |
|---|---|---|
| `specialTaxFlags` | `{ isFarmHouse: false, isHometownHouse: false, isPopulationDeclineAreaHouse: false, isLongTermRental: false }` | 사용자 자기보고 입력 활성 (B-014) |
| `specialTaxRequirementsMet` | `[]` (빈 배열) | 요건 코드별 체크박스 (B-014) |

---

## 3. caseData 최상위 신규 필드 (v0.2)

### 3-1. `householdHouseCount` (v0.2 신규)

```js
caseData.householdHouseCount: number
```

| 항목 | 내용 |
|---|---|
| 의미 | 1세대(거주자 본인 + 배우자 + 같은 주소 생계 동거 가족) 보유 주택 수 |
| 값 범위 | 정수 ≥ 1 |
| v0.2 사용 | 단계 2 1세대1주택 비과세 판정 (`=== 1`) |
| 누락 시 자동 보정 | `salePlan.candidateHouseIds.length` (v0.1 회귀 안전성, §5 자동 보정 룰) |
| 누락 보정 시 issueFlag | `HOUSEHOLD_COUNT_INFERRED` (info) |

> **주의**: `householdHouseCount`는 `houses.length`(시스템 보유 주택 정보 입력 개수)와 다르다. 사용자가 시스템에 1채만 입력했더라도 1세대 보유 주택은 2채 이상일 수 있다(다른 가족원 명의 등). 따라서 별도 명시 입력이 필요하다.

> **v0.2 화면 추가 권고**: 카드 ②.5 양도계획 또는 ② 세대정보에 "1세대 보유 주택 수" 정수 입력 1개 추가. 디폴트 값은 후보 주택 수와 동일 표시. 별도 입력 없이도 자동 보정으로 산정 가능하도록 설계.

### 3-2. `isOneTimeTwoHouses` (v0.2 신규)

```js
caseData.isOneTimeTwoHouses?: boolean
```

| 항목 | 내용 |
|---|---|
| 의미 | 일시적 2주택 특례 해당 여부 (사용자 자기보고) |
| 값 | `true` / `false` (선택, 누락 시 false) |
| v0.2 사용 | `ONE_TIME_2HOUSES_NOT_APPLIED` (warning) issueFlag 발동 트리거. 산식 분기 없음(다주택 일반과세로 처리). |
| 누락 시 자동 보정 | `false` |
| 활성 시점 | v0.3 또는 v0.5 (시행령 제155조 ① 본격 처리) |

> **v0.2 화면 추가 권고**: 카드 ②.5 양도계획에 "일시적 2주택 특례 해당 여부" 토글(yes/no) 1개 추가. 디폴트 false.

---

## 4. v0.2 활용 필드 정리표

| 필드 위치 | 필드명 | v0.1 | v0.2 | 활성 단계 |
|---|---|---|---|---|
| caseData | `baseYear` | ✅ | ✅ | 0 (검증) |
| caseData | `householdMembers` | ✅ | ✅ | (정보) |
| caseData | `basicDeductionUsed` | ✅ | ✅ | 6 |
| **caseData** | **`householdHouseCount`** | ❌ | **✅ 신규** | **2** |
| **caseData** | **`isOneTimeTwoHouses`** | ❌ | **✅ 신규** | **(issueFlag)** |
| House | `id`, `nickname`, `location` | ✅ | ✅ | (식별·표시) |
| House | `acquisitionDate` | ✅ | ✅ | 8, **2**, **4** |
| House | `acquisitionPrice` | ✅ | ✅ | 1 |
| House | `necessaryExpense` | ✅ | ✅ | 1 |
| House | `acquisitionRegulated` | 보존 | **✅ 활성** | **2** |
| House | `residenceMonths` | 보존 | **✅ 활성** | **2**, **4** |
| House | `livingNow` | 보존 | (보존) | (표시) |
| House | `expectedSaleDate` | ✅ | ✅ | 8, **2**, **4** |
| House | `expectedSalePrice` | ✅ | ✅ | 1, 13, **2**, **3** |
| House | `saleRegulated` | 보존 | (보존) | (v0.3) |
| House | `specialTaxFlags` (v0.1.2) | 보존 | (보존) | (v0.6+) |
| House | `specialTaxRequirementsMet` (v0.1.2) | 보존 | (보존) | (v0.6+) |

---

## 5. validateCaseData 자동 보정 룰 (v0.2)

### 5-1. 보정 규칙 표

| 필드 | 누락 시 자동 보정값 | issueFlag | 출처 |
|---|---|---|---|
| `caseData.householdHouseCount` | `salePlan.candidateHouseIds.length` | `HOUSEHOLD_COUNT_INFERRED` (info) | v0.2 |
| `caseData.isOneTimeTwoHouses` | `false` | 없음 | v0.2 |
| `House.acquisitionRegulated` | `false` | 없음 (v0.1 호환) | v0.2 |
| `House.residenceMonths` | `0` | `RESIDENCE_MONTHS_DEFAULTED_ZERO` (info) | v0.2 |
| `House.livingNow` | `false` | 없음 | v0.2 |
| `House.specialTaxFlags` | 4개 false 객체 | 없음 | v0.1.2 |
| `House.specialTaxRequirementsMet` | `[]` | 없음 | v0.1.2 |

### 5-2. 보정 적용 시점

`validateCaseData(caseData)` 호출 시점에 보정값을 적용한 새 객체를 반환. 입력 객체는 변경하지 않음(불변성).

```js
// 의사코드 (산식만 — Claude Code 구현 시 실제 코드)
function validateCaseData(caseData) {
  const errors = [];
  const warnings = [];
  const issueFlags = [];

  // ① 자동 보정
  const normalized = applyDefaults(caseData);  // §5-1 표 적용

  // ② 검증 (정수 ≥ 1, 부등식 등)
  // ... 명세서 §7-1, §7-2 참조

  return { ok: errors.length === 0, errors, warnings, issueFlags, normalized };
}
```

### 5-3. v0.1 골든셋 회귀 안전성

§5-1의 자동 보정만으로는 v0.1 골든셋(TC-001~005)이 1세대1주택 비과세 케이스로 분기될 위험이 있음(명세서 v0.2.0 §9-1 참조). 따라서 **`docs/v0.1/06_test_cases.md`를 v0.1.2로 패치하여 TC-001~005 입력에 `householdHouseCount: 2`를 명시 추가**하는 부수 패치 권고.

---

## 6. 화면 ↔ caseData 매핑 (v0.2 추가)

### 6-1. v0.2 신규 입력 컴포넌트 권고

`docs/02_saleplan_ui_design.md` §6에 정의된 카드 ②.5 양도 계획에 다음 2개 입력을 추가 권고:

| 화면 입력 ID (제안) | 화면 라벨 | caseData 경로 | 입력 형태 |
|---|---|---|---|
| `household-house-count` | 1세대 보유 주택 수 | `householdHouseCount` | number input (정수 ≥ 1, 디폴트 candidateHouseIds.length) |
| `is-one-time-two-houses` | 일시적 2주택 특례 해당 여부 | `isOneTimeTwoHouses` | toggle (yes/no, 디폴트 no) |

### 6-2. v0.1.1에서 활성화된 House 카드 컴포넌트 (v0.2 활성)

다음은 v0.1 단계에서 화면에 이미 추가된 입력. v0.2 코드에서 본격 사용:

| 화면 입력 ID | 화면 라벨 | caseData 경로 | v0.2 사용 |
|---|---|---|---|
| `a-acq-regulated` | 취득 당시 조정대상지역 여부 | `houses[0].acquisitionRegulated` | ✅ 거주요건 분기 |
| `a-reside-months` | 실거주 기간 (개월) | `houses[0].residenceMonths` | ✅ 비과세 거주요건 + 표 2 |
| `a-living-now` | 현재 거주 중 | `houses[0].livingNow` | (보존, 결과 표시) |

---

## 7. v0.1 계산 함수 입력측 계약 (v0.2 보강)

`calculateSingleTransfer(caseData, houseId)` 진입부에서 단축형 매핑(`tax_engine.md` §3-2):

```js
// 의사코드
const input = {
  // ─── v0.1 그대로 ───
  salePrice:           house.expectedSalePrice,
  acquisitionPrice:    house.acquisitionPrice,
  necessaryExpense:    house.necessaryExpense,
  acquisitionDate:     house.acquisitionDate,
  saleDate:            house.expectedSaleDate,
  basicDeductionUsed:  caseData.basicDeductionUsed,
  acquisitionRegulated: house.acquisitionRegulated,
  saleRegulated:        house.saleRegulated,
  residenceMonths:      house.residenceMonths,
  livingNow:            house.livingNow,
  candidateHouseCount:  caseData.salePlan.candidateHouseIds.length,

  // ─── v0.2 신규 ───
  householdHouseCount:  caseData.householdHouseCount,
  isOneTimeTwoHouses:   caseData.isOneTimeTwoHouses
};
```

---

## 8. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.0 | 2026-04-26 | 초기 작성 |
| v0.1.1 | 2026-04-28 | 비조정대상지역 가정 명시, `expectedSale*` 변수명 정합성 |
| v0.1.2 | 2026-04-30 | 의사결정 #10 보강 4건 반영(`specialTaxFlags`·`specialTaxRequirementsMet` 추가, v0.1 미입력 처리). 골든셋 영향 없음. |
| v0.2.0 | 2026-04-30 | **v0.2 활성 필드**: `acquisitionRegulated`, `residenceMonths`, `livingNow` (House)을 보존→활성. **신규 필드**: `householdHouseCount`, `isOneTimeTwoHouses` (caseData 최상위) 2개 추가. 자동 보정 룰 7항목 확장. v0.1 골든셋 입력 `householdHouseCount: 2` 추가 패치 권고(§5-3). |
