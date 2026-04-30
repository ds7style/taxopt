# TaxOpt 입력 스키마 v0.1.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.1/03_input_schema.md` |
| 버전 | v0.1.1 | v0.1.2 |
| 상태 | ✅ 검증 완료 (2026-04-28) |
| 검증 방식 | 검증팀 손계산 + 국세청 홈택스 모의계산 3자 일치 |
| 작성일 | 2026-04-26 |
| 검증 완료일 | 2026-04-28 | 2026-04-28 (단일 주택 일반과세 본문) / 2026-04-30 (v0.6+ 확장 필드 추가, 미사용 처리) |
| 관련 문서 | (기존 3건) | 기존 + `docs/99_decision_log.md` (의사결정 #10) |
| 다음 버전 | v0.2 (조정대상지역·다주택 입력 활성화 예정) | v0.2 (조정대상지역·다주택 입력 활성화 예정), v0.6+ (조특법 특례주택 입력 활성화 예정) |

---

## 0. 문서 위치

본 문서는 계산 엔진 입력값 `caseData`의 **JSON 스키마**와 화면(`04_index_input_screen.html` → 신 `index.html`) ↔ caseData 매핑표를 정의합니다. 입력 수집·정규화 로직(`collectCaseData`, `validateCaseData`)의 입력측 계약 문서입니다.

salePlan 입력 영역의 화면 설계는 `docs/02_saleplan_ui_design.md`에서 확정됨. 본 문서는 그 결과를 v0.1 계산 엔진 입력 관점에서 다시 정리합니다.

---

## 1. caseData 최상위 구조

```js
caseData = {
  baseYear:           number,    // 시뮬레이션 기준 연도, 예: 2026
  householdMembers:   number,    // 세대원 수, ≥ 1
  basicDeductionUsed: boolean,   // 동일 과세연도 내 기본공제 이미 사용 여부
  houses:             House[],   // v0.1: 1개만 사용 (salePlan.candidateHouseIds.length === 1)
  salePlan:           SalePlan
}
```

---

## 2. House 스키마

```js
House = {
  // 식별
  id:                     "A" | "B" | "C",
  nickname:               string,                  // 사용자 입력 별칭, 누락 시 "주택 A" 등 자동
  location:               string,                  // 소재지 텍스트

  // 취득
  acquisitionDate:        "YYYY-MM-DD",            // ISO date
  acquisitionPrice:       number,                  // 원 단위 정수 ≥ 1
  necessaryExpense:       number,                  // 원 단위 정수 ≥ 0 (자본적지출+양도비 합계, v0.1 단일 필드)
  acquisitionRegulated:   boolean,                 // 취득 당시 조정대상지역 여부 (v0.1: false 가정, 보존만)

  // 거주
  residenceMonths:        number,                  // 실거주 누적 기간 (개월), v0.2 비과세용 보존
  livingNow:              boolean,                 // 현재 거주 중 여부, v0.2 비과세용 보존

  // 양도
  expectedSaleDate:       "YYYY-MM-DD",            // ISO date
  expectedSalePrice:      number,                  // 원 단위 정수 ≥ 1
  saleRegulated:          boolean,                  // 양도 당시 조정대상지역 여부 (v0.1: false 가정, 보존만)

  // ─── v0.6+ 조특법 특례주택 확장 대비 (의사결정 #10 보강 4) ───
      // v0.1에서는 모든 필드 미사용. 누락 시 빈 객체·빈 배열로 자동 보정.
      specialTaxFlags:             SpecialTaxFlags,         // 조특법 특례주택 자기보고 플래그
      specialTaxRequirementsMet:   string[]                 // 조특법 특례 요건 충족 자기보고 코드 목록
}

SpecialTaxFlags = {
      isFarmHouse:                  boolean,    // 농어촌주택 (조특법 §99의4 예상)
      isHometownHouse:              boolean,    // 고향주택 (조특법 §99의4 예상)
      isPopulationDeclineAreaHouse: boolean,    // 인구감소지역주택 (조특법 §71의2 예상)
      isLongTermRental:             boolean     // 장기임대주택 (조특법 §97의3 등 예상)
      // v0.6+ 확장 시 추가SpecialTaxFlags = {
      isFarmHouse:                  boolean,    // 농어촌주택 (조특법 §99의4 예상)
      isHometownHouse:              boolean,    // 고향주택 (조특법 §99의4 예상)
      isPopulationDeclineAreaHouse: boolean,    // 인구감소지역주택 (조특법 §71의2 예상)
      isLongTermRental:             boolean     // 장기임대주택 (조특법 §97의3 등 예상)
      // v0.6+ 확장 시 추가
}

```

### 2-1. v0.1에서 실제 계산에 사용되는 필드

| 필드 | 사용 단계 |
|---|---|
| `acquisitionDate` | 8단계 보유기간 분기 |
| `acquisitionPrice` | 1단계 양도차익 |
| `necessaryExpense` | 1단계 양도차익 |
| `expectedSaleDate` | 8단계 보유기간 분기 + `OUT_OF_V01_SCOPE_DATE` 검증 |
| `expectedSalePrice` | 1단계 양도차익 + 13단계 세후 매각금액 |

### 2-2. v0.1에서 계산에 사용되지 않는 필드 (보존만)

| 필드 | 보존 이유 |
|---|---|
| `acquisitionRegulated` | v0.2 다주택 중과 판정용 |
| `saleRegulated` | v0.2 다주택 중과 판정용 |
| `residenceMonths` | v0.2 1세대1주택 비과세 거주요건 |
| `livingNow` | v0.2 거주성 판정 |
| `nickname`, `location` | 결과 화면 표시 |
| `specialTaxFlags` | v0.6+ 조특법 특례주택 흡수 (의사결정 #10 보강 4) |
| `specialTaxRequirementsMet` | v0.6+ 조특법 특례 요건 충족 자기보고 (의사결정 #10 보강 4) |

> **issueFlag 동작**: `acquisitionRegulated === true` 또는 `saleRegulated === true`이면 `OUT_OF_V01_SCOPE_REGULATED_AREA` 발동. 계산은 일반과세로 진행되지만 결과 화면에 경고 카드 표시.

### 2-3. v0.1에서 미입력으로 가정되는 필드

다음은 입력 화면에 없으며, v0.1 코드에서 다음과 같이 가정합니다:

| 가정 항목 | 가정값 | issueFlag |
|---|---|---|
| 등기 여부 | 등기자산 | `UNREGISTERED_ASSET_ASSUMED_FALSE` (info) |
| 취득 원인 | 매매취득 | `ACQUISITION_CAUSE_ASSUMED_PURCHASE` (info) |
| 자산 종류 | 주택 | (가정 기본값) |
| 명의 | 단독명의 | (가정 기본값) |

### 2-4. v0.6+ 확장 대비 필드 (v0.1 미입력 처리)

    `specialTaxFlags`와 `specialTaxRequirementsMet`은 입력 화면(②.5 카드 또는 ③ 주택별 카드)에 v0.1~v0.5 단계까지는 노출되지 않습니다. v0.1 코드는 다음과 같이 자동 보정합니다.

    | 필드 | v0.1 누락 시 자동 보정값 | v0.6+ 활성 시 처리 |
    |---|---|---|
    | `specialTaxFlags` | `{ isFarmHouse: false, isHometownHouse: false, isPopulationDeclineAreaHouse: false, isLongTermRental: false }` | 사용자 자기보고 입력 활성화 (B-014) |
    | `specialTaxRequirementsMet` | `[]` (빈 배열) | 요건 코드별 체크박스 활성화 (B-014) |

    > **v0.1 검증 동작**: `validateCaseData`는 두 필드의 누락을 에러로 처리하지 않습니다. 누락 시 자동 보정값을 적용하고 issueFlag도 발동하지 않습니다(v0.6+에서 활성될 인터페이스 확장점 사전 노출). v0.1 골든셋(TC-001~005)은 두 필드를 입력하지 않은 상태로 작성되어 있으며, 본 패치 적용 후에도 회귀 테스트는 영향 받지 않습니다.

    > **v0.6+ 활성 시점**: 의사결정 #14~#17(B-014~B-017 처리)에서 본 필드의 활성 정책·후보군 자동 축소 정책·중복적용 배제 처리·한시 특례 만료일 관리가 별도 결정될 예정입니다.

---

## 3. SalePlan 스키마

`docs/02_saleplan_ui_design.md`의 §2 정의를 v0.1 관점에서 재정리:

```js
SalePlan = {
  targetSaleCount:                  number | "undecided",  // v0.1: 1로 고정
  candidateHouseIds:                string[],              // v0.1: 길이 1, 예: ["A"]
  fixedSaleHouseIds:                string[],              // v0.1: 길이 1, 예: ["A"]
  excludedHouseIds:                 string[],              // v0.1: 빈 배열
  allowSystemToChooseSaleTargets:   boolean,               // v0.1: false (단일 주택이라 의미 없음)
  allowYearSplitting:               boolean,               // v0.1: false
  targetSaleYears:                  number[]               // v0.1: 길이 1, 예: [2026]
}
```

### 3-1. v0.1에서의 SalePlan 단순화

v0.1은 단일 주택 1건 양도만 처리하므로 SalePlan은 사실상 다음 한 가지 형태만 가능:

```js
{
  targetSaleCount: 1,
  candidateHouseIds: ["A"],
  fixedSaleHouseIds: ["A"],
  excludedHouseIds: [],
  allowSystemToChooseSaleTargets: false,
  allowYearSplitting: false,
  targetSaleYears: [2026]   // 또는 baseYear
}
```

> **그래도 SalePlan을 받는 이유**: v0.2~v0.3에서 시나리오 엔진이 들어올 때 입력 스키마가 흔들리지 않도록 v0.1 단계에서 미리 받아둠. 화면(②.5 카드)도 v0.1부터 표시.

### 3-2. SalePlan 검증 코드

v0.1에서는 다음 검증만 활성:

| 코드 | 조건 | 처리 |
|---|---|---|
| `SP_E001` | `fixedSaleHouseIds ∩ excludedHouseIds ≠ ∅` | 차단 |
| `SP_E002` | `fixedSaleHouseIds.length > targetSaleCount` | 차단 |
| `SP_W001`~`SP_W004` | 다양한 경고 케이스 | 경고만 |

상세는 `docs/02_saleplan_ui_design.md` §2-2 참조.

---

## 4. 화면 입력값 ↔ caseData 매핑표

### 4-1. 카드 ② 공통 정보

| 화면 입력 ID | 화면 라벨 | caseData 경로 | 변환 규칙 | 누락 시 처리 |
|---|---|---|---|---|
| `base-year` | 시뮬레이션 기준 연도 | `caseData.baseYear` | `parseInt(value, 10)` | field-error 등재 (필수) |
| `household-members` | 세대원 수 | `caseData.householdMembers` | `parseInt(value, 10)` | field-error 등재 (필수) |
| `basic-deduction-used` | 당해연도 기본공제 사용 여부 | `caseData.basicDeductionUsed` | `"yes" → true`, `"no" → false` | 기본값 `"no"` |
| `btn-2` / `btn-3` (active) | 보유 주택 수 (토글) | `caseData.houses.length` | active 클래스로 2 또는 3 결정 | v0.1은 1 고정이므로 발표 데모에서는 사용하지 않음 |

### 4-2. 카드 ②.5 양도 계획

`docs/02_saleplan_ui_design.md` §6 그대로. v0.1에서는 모든 입력이 단일 주택 디폴트값으로 고정.

### 4-3. 카드 ③ 주택별 (주택 A 기준, B/C 동일 패턴)

| 화면 입력 ID | 화면 라벨 | caseData 경로 | v0.1 사용 |
|---|---|---|---|
| `a-nickname` | 주택 별칭 | `houses[0].nickname` | ✅ (화면 표시용) |
| `a-location` | 소재지 | `houses[0].location` | ✅ (화면 표시용) |
| `a-acq-date` | 취득일 | `houses[0].acquisitionDate` | ✅ |
| `a-acq-price` | 취득가액 | `houses[0].acquisitionPrice` | ✅ |
| `a-acq-cost` | 필요경비 | `houses[0].necessaryExpense` | ✅ (단일 필드, issueFlag 발생) |
| `a-acq-regulated` | 취득 당시 조정대상지역 | `houses[0].acquisitionRegulated` | ⚠️ 보존만, true 시 issueFlag |
| `a-reside-months` | 실거주 기간 (개월) | `houses[0].residenceMonths` | ⚠️ 보존만 (v0.2) |
| `a-living-now` | 현재 거주 중 | `houses[0].livingNow` | ⚠️ 보존만 (v0.2) |
| `a-sale-date` | 양도 예정일 | `houses[0].expectedSaleDate` | ✅ |
| `a-sale-price` | 양도 예정가액 | `houses[0].expectedSalePrice` | ✅ |
| `a-sale-regulated` | 양도 시 조정대상지역 | `houses[0].saleRegulated` | ⚠️ 보존만, true 시 issueFlag |
| (자동) | 주택 ID | `houses[0].id` | ✅ 상수 `"A"` |

> 변수명 차이 주의: 화면 측의 `a-sale-date`/`a-sale-price`는 caseData에서 `expectedSaleDate`/`expectedSalePrice`로 매핑됨 (`02_saleplan_ui_design.md` §3-3 기준). 계산 엔진 내부에서는 단축형 `saleDate`/`salePrice`로 받아서 사용해도 무방하나, caseData 자체의 키는 `expectedSale*` 유지.

---

## 5. v0.1 계산 함수의 입력측 계약

`calculateSingleTransfer(caseData, houseId)` 함수의 입력 계약은 다음과 같이 단순화됩니다:

```js
// 입력
const input = {
  salePrice:           caseData.houses[i].expectedSalePrice,
  acquisitionPrice:    caseData.houses[i].acquisitionPrice,
  necessaryExpense:    caseData.houses[i].necessaryExpense,
  acquisitionDate:     caseData.houses[i].acquisitionDate,
  saleDate:            caseData.houses[i].expectedSaleDate,
  basicDeductionUsed:  caseData.basicDeductionUsed,

  // 보존 (계산엔 안 쓰지만 issueFlag 판정에 사용)
  acquisitionRegulated: caseData.houses[i].acquisitionRegulated,
  saleRegulated:        caseData.houses[i].saleRegulated
};
```

> 이 변환은 `tax_engine.js`의 `calculateSingleTransfer` 진입부에서 수행하며, 외부에서는 항상 `caseData` 전체를 넘긴다 (DOM 직접 접근 금지).

---

## 6. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.0 | 2026-04-26 | 초기 작성 (계산 엔진 명세서 §2 입력 스키마와 일체) |
| v0.1.1 | 2026-04-28 | 별도 문서로 분리. 비조정대상지역 가정 + `OUT_OF_V01_SCOPE_REGULATED_AREA` 명시. `02_saleplan_ui_design.md`와의 변수명 정합성 점검 (`expectedSale*` 유지). |
| v0.1.2 | 2026-04-30 | 의사결정 #10 보강 4건 반영. House에 `specialTaxFlags`·`specialTaxRequirementsMet` 필드 추가(v0.6+ 조특법 특례주택 확장 대비). v0.1 미입력 처리(자동 보정값 적용). 골든셋 영향 없음. |
