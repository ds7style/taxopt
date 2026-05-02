# tax_engine.js 모듈 스펙 v0.3-A

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.3/modules/tax_engine.md` |
| 버전 | v0.3-A (다주택 중과 + saleRegulated 활성, 시나리오 엔진 미포함) |
| 상태 | 작성 완료 (2026-05-02, 작업 창 #11) |
| 작성 출처 | 작업 창 #11 (v0.3-A 모듈 스펙 — tax_rules.md + tax_engine.md 통합 갱신) |
| 대상 코드 | `js/tax_engine.js` (Claude Code 산출, v0.2.0 → v0.3-A 패치, 본 모듈 스펙은 .js 본문 산출 금지 — 의사결정 #9 v9) |
| 대상 테스트 | `tests/tax_engine.test.js` (Claude Code 산출, v0.2.0 → v0.3-A 패치) |
| 관련 작업지시서 | `docs/05_code_work_orders/06_tax_engine_v0_3_a.md` (작업 창 #12 산출 예정) |
| 관련 명세서 | `docs/v0.3/01_calc_engine_spec.md` v0.3-A (✅ 검증 통과, KPI 100%, 2026-05-02) |
| 관련 입력 스키마 | `docs/v0.3/03_input_schema.md` v0.3-A (saleRegulated 활성 명시) |
| 관련 골든셋 | `docs/v0.3/06_test_cases.md` v0.3-A (TC-006~010 v0.2 회귀 + TC-011~014 v0.3-A 신규, 검증 후 갱신) |
| 의존 모듈 스펙 | `docs/v0.3/modules/tax_rules.md` v0.3-A (**`HEAVY_TAX_RATE_ADDITION` 룩업 + `findHeavyTaxRateAddition` 헬퍼 정본** — §0-1, 본 작업 창 동시 산출) |
| 이전 버전 | v0.2.1 (`docs/v0.2/modules/tax_engine.md`, 5/2 KPI 100% 검증 통과, 회귀 534/0) |
| 다음 버전 | v0.3-B (시나리오 엔진 도입 시 갱신), post-MVP (시행령 제167조의10·11 단서 본격 처리) |
| 관련 의사결정 | `docs/99_decision_log.md` #1 (중과 유예 처리), #5 강화 (법령 개정 대응 아키텍처 — §0-1), #6 (영속화 의무), #9 v9 (.js 본문 산출 금지), #10 (시나리오 엔진은 v0.3-B), #11 (정확성 > 속도), #12 (모듈 스펙 v0.3-A 정본화) |
| 관련 백로그 | B-008 (effectiveTaxRate, v0.1 처리), B-009 (1세대1주택 비과세, v0.2 처리), B-019 (자동 보정 룰 — `householdHouseCount`·`residenceMonths` 등, §8-3), B-020 (의사결정 #5 강화 — 명세서 §0-1), B-021 (법제처 OpenAPI 활용 검토), B-022 (양도소득세 정수 처리, v0.3-A 무영향), B-023 (양도소득세 부칙·경과규정 — 강남3구·용산 한시 유예 미처리, §6-A), B-024 (일시적 2주택 — v0.3-A 미포함, 명세서 §1-4), B-032 (결과 객체 구조 명세 vs 코드 불일치 — **v0.3-A 범위 외, v0.2.1 그대로**), B-033 (자동 조정대상지역 판정 — post-MVP 인계, B-021 통합) |

---

## 0. 문서 위치·역할

본 문서는 `js/tax_engine.js`의 **계약 문서 v0.3-A판**입니다. v0.2.1 모듈 스펙(459줄)을 베이스로 하여, v0.3-A 명세서가 활성화한 **단계 4 변경(중과 시 장특공 배제) + 단계 9 변경(중과 시 누진세율 + 가산세율 동적 재계산) + 보유 < 2년 + 중과 max 비교** 의 계약을 추가합니다.

코드 본문(`js/tax_engine.js`)과 본 문서가 충돌하면 **본 문서를 우선**합니다. 본 문서를 변경해야 하는 경우는 v0.3-A 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신합니다.

본 문서는 **명세서 v0.3-A의 13단계 산식 + §3 다주택 중과 판정 메커니즘을 그대로 코드 계약으로 옮긴 것**입니다. 산식·상수·issueFlag 발동 조건은 모두 명세서 §2~§9를 단일 정본으로 합니다. 본 문서가 명세서와 충돌하면 명세서가 우선합니다.

### 0-1. v0.2.1 → v0.3-A 변경 요약

| 영역 | v0.2.1 | v0.3-A |
|---|---|---|
| 노출 멤버 | 20종 (v0.1 17 + v0.2 신규 3) | **21종** (v0.2 20 + v0.3-A 신규 1 권장 — `isHeavyTaxationApplicable`) |
| **단계 4 (장특공)** | 표 1·2 분기 적용 | + **다주택 중과 발동 시 `longTermDeduction = 0` (제95조 ② 단서)** |
| **단계 8 (보유기간 분기)** | `under1y`·`under2y`·`over2y` 산출 | 동일 (분기 자체 불변, 단 `under1y`·`under2y` + 중과 케이스는 §5-A-9-2 추가 처리) |
| **단계 9 (세율)** | 단기세율 또는 누진세율 적용 | + **중과 시 누진세율 + 가산세율(`+20%p` / `+30%p`) 동적 재계산** + **보유 < 2년 + 중과 시 max 비교 (제104조 ⑦ 본문 단서)** |
| `result.steps` 필드 | v0.2 23종 (v0.1 13 + v0.2 신규 10) | + **v0.3-A 신규 4종 (`isHeavyTaxation`·`heavyRateAddition`·`shortTermTax`·`heavyProgressiveTax`) = 27종** |
| issueFlag | 18종 (v0.1 10 + v0.2 신규 8) | **활성 25종** (v0.2 18 + v0.3-A 신규 5 + 보조 3 − 폐기 1 = 순증 7) |
| `tax_rules.js` 의존 | 24종 노출 멤버 (v0.1 17 + v0.2 신규 7) 중 17종 사용 (정본 명칭 기준) | **26종 노출 멤버 (v0.2 24 + v0.3-A 신규 2) 중 19종 사용** (정본 명칭 기준, 별칭 4종 영구 제거) |
| 부트스트랩 가드 | v0.1 1건 + v0.2 추가 1건 | **+ v0.3-A 추가 1건** (가드 2-A — `findHeavyTaxRateAddition` 미로드 차단) |
| 입력 스키마 | `saleRegulated` 보존 (산식 미사용) | **`saleRegulated` 활성** (다주택 중과 판정용 — 단계 4 진입 직전) |

### 0-2. 본 모듈 스펙이 처리하지 않는 영역 (v0.3-A 범위 외)

| 영역 | 처리 시점 |
|---|---|
| **B-032 결과 객체 구조 명세 vs 코드 불일치** (인계 1) | **v0.3-A 범위 외**. 5/6 PRD 또는 v0.3-B 진입 시점에 별도 처리. **본 모듈 스펙은 v0.2.1 명세 패턴 그대로 따른다** (§4-1 톱레벨 + §4-2 result.steps 표기 그대로 유지) |
| 시나리오 엔진 (어느 1채·순서·시점 비교) | v0.3-B (별도 작업 창) |
| 자동 조정대상지역 판정 (B-033) | post-MVP (B-021 통합) |
| 일시적 2주택 특례 (B-024) | v0.3-B 또는 post-MVP (명세서 §1-4 옵션 (나) 미포함 채택) |
| 시행령 제167조의10·11 단서 (중과 배제 사유, 인계 4) | post-MVP (issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` info로 v0.3-A 표시) |
| 강남3구·용산 한시 유예 (계약 2026-05-09 이전 + 잔금 4개월 이내, B-023) | post-MVP (issueFlag `HEAVY_TAX_TRANSITION_NOT_HANDLED` info, 입력 필드 `contractDate` 부재로 실 발동 빈도 0) |

> **인계 1 (B-032) 명시 결정**: 본 모듈 스펙 §4-1·§4-2의 결과 객체 구조 표기는 v0.2.1 모듈 스펙 패턴 그대로 계승한다. 실제 코드(e36cb68)는 `result.metrics.totalTax` + `result.steps.totalTax` 캡슐화 구조이나, 이는 5/6 PRD 또는 v0.3-B 진입 시점에 별도 정정. v0.3-A는 명세 vs 코드 불일치를 인지하되 본 작업 범위 외로 처리.

---

## 1. 노출 객체

```js
window.TaxOpt.taxEngine
```

ES6 module(`import`/`export`)을 사용하지 않습니다(decision_log #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화합니다.

`window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback합니다. v0.1·v0.2와 동일.

---

## 2. 노출 멤버 (전체, v0.3-A)

> v0.2.1 노출 20종은 **모두 시그니처 유지**한다. v0.3-A 신규는 별도 표기.

| 멤버 | 타입 | 역할 | v0.3-A 변경 |
|---|---|---|---|
| `ENGINE_VERSION` | string | 결과 객체에 기록할 엔진 버전 식별자 | **`"v0.3.0-A"`로 갱신** (Claude Code 결정 권장) |
| `calculateSingleTransfer(caseData, houseId?)` | function | 메인 진입점, 13단계 통합 실행 | 단계 4·9 본문 변경 (중과 분기 추가) |
| `validateCaseData(caseData)` | function | 입력 검증 (0단계) | 동일 (saleRegulated 기존 검증 유지, 신규 검증 항목 없음) |
| `computeTransferGain(input)` | function | 1단계 양도차익 | 동일 |
| `applyNonTaxation(transferGain, caseData)` | function | 2단계 비과세 | 동일 (v0.2.1 활성 본문 그대로) |
| `applyHighValueAllocation(taxableGain, caseData)` | function | 3단계 고가주택 안분 | 동일 (v0.2.1 활성 본문 그대로) |
| `computeLongTermDeduction(taxableGain, caseData)` | function | 4단계 장특공 | **본문 변경**: 중과 발동 시 `longTermDeduction = 0` (§5-A-4) |
| `computeCapitalGainIncome(taxableGain, longTermDeduction)` | function | 5단계 양도소득금액 | 동일 |
| `computeBasicDeduction(basicDeductionUsed)` | function | 6단계 기본공제 | 동일 |
| `computeTaxBase(capitalGainIncome, basicDeduction)` | function | 7단계 과세표준 | 동일 |
| `determineHoldingPeriodBranch(acquisitionDate, saleDate)` | function | 8단계 보유기간 분기 | 동일 (분기 자체 불변) |
| `determineAppliedRate(branch, taxBase)` | function | 9단계 적용 세율 결정 | **본문 변경**: 중과 시 누진세율 + 가산세율 합산 (§5-A-9) |
| `computeCalculatedTax(taxBase, appliedRate)` | function | 10단계 산출세액 | **본문 변경**: 중과 시 동적 재계산 (§5-A-9-1), 보유 < 2년 + 중과 시 max 비교 (§5-A-9-2) |
| `computeLocalIncomeTax(calculatedTax)` | function | 11단계 지방소득세 | 동일 (중과 후 calculatedTax에 적용) |
| `computeTotalTax(calculatedTax, localIncomeTax)` | function | 12단계 총 납부세액 | 동일 |
| `computeNetAfterTaxSaleAmount(salePrice, totalTax)` | function | 13단계 세후 매각금액 | 동일 |
| `computeEffectiveTaxRate(totalTax, salePrice)` | function | metrics 보강 (B-008) | 동일 |
| `collectIssueFlags(caseData, intermediates)` | function | issueFlag 수집 | **활성 25종으로 확장** (§6-A) |
| `selfTest()` | function | 부트스트랩 종합 자체검증 | TC-011·012 sanity 추가 권장 (§6-1-A) |
| `check1Se1HouseExemption(input)` | function | 1세대1주택 비과세 판단 (v0.2 신규) | 동일 |
| `calculateHighValuePortion(input)` | function | 고가주택 안분 산식 (v0.2 신규) | 동일 |
| `calculateLongTermDeduction(input)` | function | 장특공 표 1·2 산출 분기 (v0.2 신규) | **본문 변경**: 중과 발동 시 진입하지 않음 (상위 분기에서 차단, §5-A-4) |
| **`isHeavyTaxationApplicable(caseData, intermediates)`** (v0.3-A) | function | **(신규 권장)** 다주택 중과 4단계 조건 평가 | **v0.3-A 신규** (§5-5) |

> **노출 원칙**: v0.1·v0.2와 동일. 13단계 각 함수와 v0.2 신규 보조 함수 3종 + v0.3-A 신규 보조 함수 1종을 모두 노출하는 이유는 (1) 회귀 테스트가 단계별 중간값을 검증해야 하고, (2) v0.3-B 시나리오 엔진이 일부 단계만 재사용할 수 있어야 하기 때문. 노출은 **읽기 전용 사용**을 전제로 한다 (불변성 약속, §7).

> **v0.3-A `isHeavyTaxationApplicable` 노출 권장 사유**: 단계 4·9 양쪽에서 호출되는 **4단계 조건 평가 함수**. 내부 함수로만 두면 (a) 회귀 테스트가 4단계 조건 단독 검증 불가, (b) v0.3-B 시나리오 엔진이 시나리오별 중과 발동 여부 판정 불가. 따라서 v0.2 신규 보조 함수 3종(`check1Se1HouseExemption` 등)과 동일 패턴으로 노출 권장.

---

## 3. 입력 caseData 스키마

`docs/v0.3/03_input_schema.md` v0.3-A §1, §2를 그대로 따른다. 본 문서는 다시 정의하지 않는다.

요점만 재기술:

```js
caseData = {
  baseYear:              number,
  householdMembers:      number,
  basicDeductionUsed:    boolean,
  householdHouseCount:   number,        // v0.2 활성, v0.3-A에서 추가 사용 패턴 도입 (§3-2)
  isOneTimeTwoHouses:    boolean,       // v0.2 활성 (issueFlag만)
  specialTaxFlags:       object,        // v0.6+ 활성
  specialTaxRequirementsMet: string[],  // v0.6+ 활성
  houses:                House[],       // v0.3-A: salePlan.candidateHouseIds.length === 1 (단일 양도)
  salePlan:              SalePlan
}

House = {
  id, nickname, location,
  acquisitionDate, acquisitionPrice, necessaryExpense,
  acquisitionRegulated,                 // v0.2 활성 (취득시 조정대상지역 → 거주요건 판단)
  residenceMonths,                      // v0.2 활성
  livingNow,                            // v0.2 활성
  expectedSaleDate, expectedSalePrice,
  saleRegulated                         // v0.3-A 활성 (다주택 중과 판정용 — §3-1)
}
```

### 3-1. `saleRegulated` 활성 명세 (v0.3-A 신규)

| 항목 | 내용 |
|---|---|
| 입력 타입 | boolean |
| 활성 단계 | 단계 4 진입 직전 (다주택 중과 판정 — §5-5 `isHeavyTaxationApplicable`) |
| 자동 보정 | 누락 시 `false` 자동 보정 (v0.2 그대로) |
| issueFlag | `SALE_REGULATED_USER_INPUT` (info, 항상 발동) |
| 자동 판정 | **v0.3-A 미적용** (사용자 직접 입력 가정). 자동 판정은 post-MVP (B-033 + B-021 통합) |

> **B-033 (자동 조정대상지역 판정) post-MVP 인계 사유**: (a) 조정대상지역 리스트는 시점별로 변경(국토부 고시), (b) 법제처 OpenAPI 행정규칙 영역 통합 처리 권고(B-021). v0.3-A는 사용자 직접 입력 가정이며 issueFlag로 사용자 책임 명시.

> **v0.1 회귀 안전성**: v0.1 골든셋의 `saleRegulated` 미입력 → 자동 보정 `false` → 중과 미발동(조건 2 미충족) → v0.1 결과 그대로 보존. v0.2 골든셋의 `saleRegulated=false` 명시 → 동일.

### 3-2. `householdHouseCount` 사용 패턴 (v0.3-A 갱신)

`householdHouseCount`는 v0.2부터 활성. v0.3-A는 추가 사용 패턴 도입.

| 사용처 | v0.2 | v0.3-A |
|---|---|---|
| 단계 2 — 1세대1주택 비과세 판정 | `=== 1` 비교 | 동일 |
| **단계 4 — 다주택 중과 판정** | (해당 없음) | **`>= 2` 비교 (조건 1)** — §5-5 `isHeavyTaxationApplicable` |
| **단계 9 — 가산세율 룩업** | (해당 없음) | **`tax_rules.findHeavyTaxRateAddition(householdHouseCount)` 호출** — §5-A-9 |

> **3주택 이상 (`>= 3`)**: 시행령 제167조의3 ① "1세대 3주택 이상에 해당하는 주택"에 해당. 본 모듈은 `householdHouseCount >= 3`을 모두 3주택 이상 중과(+30%p)로 처리. 시행령 제167조의3 ① 단서(소형주택 산입 제외 등)는 v0.3-A 미처리(issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` info).

### 3-3. v0.2에서 활성화된 House 필드 의미 (v0.2.1 §3-1 계승)

v0.2.1 §3-1 그대로. 본 문서에서 재정의 없음.

---
## 4. 출력 객체 스키마

`calculateSingleTransfer`는 v0.2.1 출력 스키마를 그대로 유지하면서 `result.steps`에 v0.3-A 신규 필드 4개를 추가한다. 톱레벨 필드 구조는 변경 없음.

### 4-1. 결과 객체 톱레벨 (v0.2.1 동일)

```js
result = {
  engineVersion:    string,    // "v0.3.0-A"
  ruleVersion:      string,    // tax_rules.RULE_VERSION ("v0.3.0-A")
  lawRefs:          object,    // tax_rules.LAW_REFS (heavyTaxation 키 추가)
  caseDataSnapshot: object,    // 입력 캡처 (불변성 검증용)
  steps:            object,    // §4-2 (v0.3-A 보강)
  totalTax:         number,
  netAfterTaxSaleAmount: number,
  effectiveTaxRate: number | null,
  issueFlags:       IssueFlag[],
  timestamp:        string     // ISO 8601 (비결정성 항목)
}
```

> 톱레벨 필드 명·타입은 v0.1·v0.2와 100% 동일. 인터페이스 약속 보존(명세서 §0-1·§2 인터페이스 약속).

### 4-2. `result.steps` 구조 (v0.2.1 + v0.3-A 신규 4종)

> v0.2.1 23종 필드는 **이름·타입 유지**. v0.3-A 신규 필드 4종만 추가.

#### 4-2-1. v0.2.1 계승 23종

v0.2.1 §4-2 표 그대로 (23종 — `transferGain`·`taxableGain`·`nonTaxableGain`·`longTermDeduction`·`capitalGainIncome`·`basicDeduction`·`taxBase`·`holdingPeriodBranch`·`appliedRate`·`calculatedTax`·`localIncomeTax`·`is1Se1House`·`isHighValueHouse`·`allocationRatio`·`appliedDeductionTable`·`holdingYears`·`residenceYears`·`holdingRate`·`residenceRate`·`totalRate`·`terminateAt2`).

본 문서에서 재정의 없음. v0.2.1 §4-2 참조.

> **v0.3-A 의미 확장 2종**:
> - `appliedDeductionTable`: v0.2.1 분기 + 다주택 중과 발동 시 `null` (§5-A-4 단계 4 변경, 보유 ≥ 3년이라도 `null`).
> - `appliedRate`: v0.2.1 분기 + 중과 시 구조 확장 (`{ type: 'progressive_with_heavy', bracket, addition }`. 보유 < 2년 + 중과 시 명세서 §3-5-3 표 — `comparedShort`·`comparedHeavy` 플래그).

#### 4-2-2. v0.3-A 신규 4종

명세서 §3-7 표 그대로 옮김.

| 필드 | 타입 | 단계 | 의미 |
|---|---|---|---|
| **`isHeavyTaxation`** | boolean | 단계 4 진입 직전 산출 | 다주택 중과 적용 여부 (§5-5 `isHeavyTaxationApplicable` 결과). v0.3-A 핵심 분기 플래그 |
| **`heavyRateAddition`** | number \| null | 단계 4·9 | 가산세율 (`0.20`·`0.30`·`null`). 중과 미적용 시 `null` |
| **`shortTermTax`** | number \| null | 단계 9 (보유 < 2년 + 중과 분기) | 단기세율 산출세액 (max 비교용). 그 외 케이스 `null` |
| **`heavyProgressiveTax`** | number \| null | 단계 9 (보유 < 2년 + 중과 분기) | 중과 누진세율 산출세액 (max 비교용). 그 외 케이스 `null` |

> **`shortTermTax`·`heavyProgressiveTax`가 `null`인 케이스**: (a) 중과 미적용, 또는 (b) 중과 적용 + 보유 ≥ 2년 (이 경우는 max 비교 자체가 없음). max 비교 트레이스가 필요 없는 케이스에 `0`이 아닌 `null`로 채우는 이유는, 호출 측이 `=== null` 비교로 "비교가 발생하지 않은 케이스"를 명시적으로 식별하기 위함이다.

#### 4-2-3. `terminateAt2 === true`일 때의 후속 단계 값 일관성 (v0.2.1 그대로 + v0.3-A 신규 필드 정책)

v0.2.1 §4-2-1 표 그대로 적용. v0.3-A 신규 4종 필드는 다음으로 채운다:

| 필드 | terminateAt2=true 시 값 |
|---|---|
| `isHeavyTaxation` | `false` (단계 2 종료, 중과 판정 미실행) |
| `heavyRateAddition` | `null` |
| `shortTermTax` | `null` |
| `heavyProgressiveTax` | `null` |

> **회귀 안전성**: v0.1·v0.2 골든셋(TC-001~010, 모두 비과세 또는 다주택 중과 미적용 케이스)은 단계 2에서 종료되거나 단계 4·9에서 중과 분기를 타지 않으므로, v0.3-A 신규 4종 필드는 모두 위 기본값(`false`/`null`)으로 채워진다. v0.1·v0.2 결과 객체와 비교 시 v0.3-A 신규 필드를 무시하면 100% 동일.

---

## 5. 13단계 파이프라인 함수 계약 (v0.3-A 변경분만)

> 본 절은 v0.2.1과 **달라진 단계 4·9·10**과 **v0.3-A 신규 함수 1종(§5-5)**만 다룬다. 단계 0·1·2·3·5·6·7·8·11·12·13 본문은 v0.2.1 모듈 스펙과 **완전 동일**하므로 본 문서에서 재정의하지 않는다.

### 5-1. 단계 2·3 — v0.2.1 그대로 (변경 없음)

v0.2.1 모듈 스펙 §5-1 (`applyNonTaxation` + `check1Se1HouseExemption`) + §5-2 (`applyHighValueAllocation` + `calculateHighValuePortion`)와 **완전 동일**. 본 문서에서 재정의 없음.

> **v0.3-A 영향**: 단계 2 종료 시 `is1Se1House` 출력은 v0.3-A에서 §5-5 `isHeavyTaxationApplicable` 조건 4(1세대1주택 비과세 미적용)의 입력으로 추가 사용된다. 단계 2 본문은 변경 없음.

### 5-2. 단계 4 — `computeLongTermDeduction(taxableGain, caseData, intermediates)` (v0.3-A 변경)

#### 5-2-1. v0.2.1 → v0.3-A 변경 요약

v0.2.1: 단계 4는 `(taxableGain, caseData)`만 받아 `calculateLongTermDeduction` 호출 결과를 그대로 반환했다.

v0.3-A: **단계 4 진입 직전에 `isHeavyTaxationApplicable(caseData, intermediates)`를 호출**하여 다주택 중과 발동 여부를 판정. 발동 시 `longTermDeduction = 0`을 강제 (제95조 ② 단서, "장기보유특별공제는 100분의 30 또는 100분의 40을 더한 세율을 적용받는 자산에 대해서는 적용하지 아니한다"의 v0.3-A 적용).

#### 5-2-2. 함수 계약

| 항목 | 내용 |
|---|---|
| 입력 | `taxableGain` (number, 단계 3 결과), `caseData`, `intermediates`(`{ is1Se1House, holdingYears, residenceYears, isHighValueHouse }` 단계 2·3 산출분) |
| 출력 | `{ longTermDeduction: number, appliedDeductionTable: 1\|2\|null, holdingRate: number, residenceRate: number, totalRate: number, isHeavyTaxation: boolean, heavyRateAddition: number\|null }` (v0.2.1 5종 + v0.3-A 신규 2종) |
| 산식 | (1) **중과 판정**: `isHeavyTaxation = isHeavyTaxationApplicable(caseData, intermediates)` (§5-5 호출). (2) **중과 발동 분기**: `isHeavyTaxation === true`이면 `longTermDeduction = 0`, `appliedDeductionTable = null`, `holdingRate = 0`, `residenceRate = 0`, `totalRate = 0`, `heavyRateAddition = tax_rules.findHeavyTaxRateAddition(caseData.householdHouseCount)`. 보유연수 무관 (제95조 ② 단서). (3) **중과 미발동 분기**: v0.2.1 그대로 — `calculateLongTermDeduction({ taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse })` 호출 결과 + `heavyRateAddition = null`. |
| 절사 | 중과 발동 분기는 절사 자체 없음 (`longTermDeduction = 0` 고정). 중과 미발동 분기는 `calculateLongTermDeduction` 내부 1회 floor (v0.2.1 §5-3 그대로). |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | (a) `isHeavyTaxationApplicable` 내부 예외 발생 시 throw. (b) `findHeavyTaxRateAddition` 내부 예외(houseCount<2 등) 발생 시 throw — 단, `isHeavyTaxationApplicable === true`이면 `houseCount >= 2`가 보장되므로 정상 실행 시 throw 도달 없음. (c) `calculateLongTermDeduction` 내부 예외 그대로 전파. |
| issueFlag 트리거 | (중과 발동 시) `HEAVY_TAXATION_APPLIED`·`HEAVY_TAXATION_2_HOUSES`·`HEAVY_TAXATION_3_HOUSES`·`LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` (보유 ≥ 3년 시) / (중과 미발동 시) v0.2.1 그대로 (`LONG_TERM_DEDUCTION_TABLE_1`·`_TABLE_2`·`_HOLDING_LESS_THAN_3Y_FOR_TABLE_2`) |

> **`intermediates` 입력 추가 이유**: v0.2.1까지는 단계 4가 `caseData`만으로 산출 가능했으나, v0.3-A는 `is1Se1House`(단계 2 산출)를 §5-5 조건 4 평가에 사용해야 하므로 `intermediates` 인자 추가. 호환성을 위해 `intermediates`가 누락되면 `calculateSingleTransfer` 진입부에서 단계 2 결과를 재구성하여 전달.

> **§5-2-2 변경의 v0.2.1 회귀 안전성**: TC-006~010 (5건 모두 다주택 중과 미발동 케이스)에서 `isHeavyTaxation = false` 분기로 진입 → `calculateLongTermDeduction` 호출 결과 그대로 반환 → v0.2.1 결과와 100% 동치. 회귀 검증은 §6-1 sanity 케이스로 보장.

#### 5-2-3. 보조 — `calculateLongTermDeduction(input)` (v0.2.1 그대로)

v0.2.1 §5-3-1 그대로. 본 함수 시그니처·산식·절사·예외 모두 변경 없음.

> **v0.3-A에서 호출되지 않는 케이스**: 다주택 중과 발동 시 단계 4 본문이 본 함수를 호출하지 않고 `longTermDeduction = 0`을 직접 설정한다. 따라서 본 함수는 중과 미발동 케이스에서만 호출됨.

### 5-3. 단계 5·6·7·8 — v0.2.1 그대로 (변경 없음)

v0.2.1 모듈 스펙 §5-4 그대로 (단계 5: `capitalGainIncome = max(0, taxableGain − longTermDeduction)`, 단계 6: 기본공제, 단계 7: 과세표준 산출, 단계 8: 보유기간 분기).

> **v0.3-A 영향**: 단계 5는 단계 4가 `longTermDeduction = 0`을 반환하면 `capitalGainIncome = max(0, taxableGain − 0) = taxableGain` 그대로 통과 (자동 동작). 단계 8 보유기간 분기 산출 자체는 v0.2.1과 동일하나, 분기 결과(`under1y`·`under2y`·`over2y`)가 단계 9 v0.3-A 변경 분기의 입력으로 사용된다.

### 5-4. 단계 9 — `computeProgressiveTax(taxBase, caseData, intermediates)` (v0.3-A 변경)

#### 5-4-1. v0.2.1 → v0.3-A 변경 요약

v0.2.1: 단계 9는 단계 8 분기에 따라 `under1y` → 70% 단일세율, `under2y` → 60% 단일세율, `over2y` → 누진세율 산출(`PROGRESSIVE_BRACKETS` + `findBracket` 호출)을 분기했다.

v0.3-A: **중과 적용 여부에 따라 산식 흐름이 달라진다.**
1. 중과 미적용 → v0.2.1 그대로 (3종 분기).
2. **중과 적용 + 보유 ≥ 2년** (`over2y` 분기) → 누진 구간 누적 세액 동적 재계산 (§5-A-9-1).
3. **중과 적용 + 보유 < 2년** (`under1y`·`under2y`) → 단기세율 산출과 중과 누진세율 산출의 max 비교 (§5-A-9-2, 제104조 ⑦ 본문 단서).

#### 5-4-2. 함수 계약

| 항목 | 내용 |
|---|---|
| 입력 | `taxBase` (number, 단계 7 결과), `caseData`, `intermediates`(`{ holdingPeriodBranch, isHeavyTaxation, heavyRateAddition }`) |
| 출력 | `{ calculatedTax: number, appliedRate: object, shortTermTax: number\|null, heavyProgressiveTax: number\|null }` |
| 산식 | (1) **중과 미적용**: v0.2.1 §5-4 그대로 (단계 8 분기에 따라 단일세율 또는 누진세율 산출). `shortTermTax = null`, `heavyProgressiveTax = null`. (2) **중과 적용 + `over2y`**: §5-A-9-1 (중과 누진세율 동적 재계산). `shortTermTax = null`, `heavyProgressiveTax = null` (max 비교 미발생). (3) **중과 적용 + `under1y` 또는 `under2y`**: §5-A-9-2 (max 비교). `shortTermTax`·`heavyProgressiveTax` 양쪽 채움. |
| 절사 | (1) 단일세율: `Math.floor(taxBase × rate)` (v0.2.1 그대로). (2) 누진세율: `Math.floor(baseTax + (taxBase − lowerBound) × marginalRate)` 1회. (3) 중과 누진세율: `Math.floor(baseTax_with_addition + (taxBase − lowerBound) × (marginalRate + addition))` 1회 (§5-A-9-1). (4) max 비교: `short_term_tax`·`heavy_progressive_tax` 각각 floor 후 max (§5-A-9-2). |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | (a) `isHeavyTaxation === true`이고 `heavyRateAddition`이 `null`이면 throw (계약 위반). (b) `findBracket` 내부 예외 그대로 전파. |
| issueFlag 트리거 | (중과 적용 시) `HEAVY_TAX_SHORT_TERM_COMPARISON` (`under1y`·`under2y` 케이스만) / 그 외 v0.2.1 그대로 |

#### 5-4-3. 단계 9-A-1 — 중과 누진세율 동적 재계산 (보유 ≥ 2년)

명세서 §3-4-1 산식 그대로.

```
입력: taxBase, addition (0.20 or 0.30)
산출:
  1. bracket = findBracket(taxBase)            // {lowerBound, upperBound, marginalRate, baseTax}
  2. 누적 baseTax 재계산 (lowerBound까지):
       baseTax_with_addition = 0
       PROGRESSIVE_BRACKETS의 각 구간 [L_i, U_i, R_i, _]에 대해 U_i <= bracket.lowerBound이면:
         baseTax_with_addition += (U_i − L_i) × (R_i + addition)
  3. 산출세액:
       calculatedTax_heavy = baseTax_with_addition
                           + (taxBase − bracket.lowerBound) × (bracket.marginalRate + addition)
       calculatedTax = Math.floor(calculatedTax_heavy)

출력: { calculatedTax, appliedRate: { type: 'progressive_with_heavy', bracket, addition } }
```

> **`baseTax_with_addition` 누적 재계산을 상수로 보유하지 않는 이유**: 명세서 §3-4-3 참고 표(`+20%p 누적 baseTax`·`+30%p 누적 baseTax`)는 검증용 보조 자료이며, 본 모듈 구현은 `PROGRESSIVE_BRACKETS` 단일 룩업에서 산식 흐름으로 도출한다 (단일 소스 원칙 — 명세서 §0-1 원칙 (1)).

> **검증팀 손계산 예시 (taxBase = 477,500,000, 2주택 중과)**:
> - bracket = `{ lowerBound: 300_000_000, upperBound: 500_000_000, marginalRate: 0.40, baseTax: 94_060_000 }`
> - addition = 0.20
> - 누적 baseTax_with_addition = `(14M − 0) × 0.26 + (50M − 14M) × 0.35 + (88M − 50M) × 0.44 + (150M − 88M) × 0.55 + (300M − 150M) × 0.58 = 3,640,000 + 12,600,000 + 16,720,000 + 34,100,000 + 87,000,000 = 154,060,000`
> - calculatedTax_heavy = `154,060,000 + (477,500,000 − 300,000,000) × 0.60 = 154,060,000 + 106,500,000 = 260,560,000`
> - 명세서 §3-4-3 표와 일치 (TC-011 검증 통과).

#### 5-4-4. 단계 9-A-2 — 보유 < 2년 + 중과 max 비교 (제104조 ⑦ 본문 단서)

명세서 §3-5-2 산식 그대로.

```
입력: taxBase, holdingPeriodBranch ('under1y' or 'under2y'), addition (0.20 or 0.30)
산출:
  1. 단기세율 결정:
       SHORT_TERM_RATE = (holdingPeriodBranch === 'under1y') ? 0.70 : 0.60
  2. 단기세율 산출:
       short_term_tax = Math.floor(taxBase × SHORT_TERM_RATE)
  3. 중과 누진세율 산출:
       heavy_progressive_tax = §5-A-9-1 산출 결과
  4. max 비교:
       calculatedTax = max(short_term_tax, heavy_progressive_tax)
  5. 적용 세율 표시 결정:
       if (short_term_tax > heavy_progressive_tax):
         appliedRate = { type: 'short_term_60or70', rate: SHORT_TERM_RATE, comparedHeavy: true }
       else:
         appliedRate = { type: 'progressive_with_heavy', bracket, addition, comparedShort: true }

출력: { calculatedTax, appliedRate, shortTermTax: short_term_tax, heavyProgressiveTax: heavy_progressive_tax }
```

> **max 비교의 결과 객체 보존**: `shortTermTax`·`heavyProgressiveTax` 양쪽을 `result.steps`에 채워, 호출 측이 어느 쪽이 채택되었는지 트레이스 가능하게 한다 (§4-2-2 신규 4종 필드).

> **issueFlag 발동**: 본 분기는 항상 `HEAVY_TAX_SHORT_TERM_COMPARISON` info 발동 (명세서 §6 — `isHeavyTaxationApplicable && holdingPeriodBranch !== 'over2y'`).

> **TC-014 검증 결과 (보유 1.5년 + 2주택 중과 미실시)**: 본 분기 적용 시 산출세액 정합 검증 통과 (5/2 KPI 100%).

### 5-5. v0.3-A 신규 함수 — `isHeavyTaxationApplicable(caseData, intermediates)`

명세서 §3-1 평가 함수 그대로 옮긴다.

| 항목 | 내용 |
|---|---|
| 입력 | `caseData`(`{ houses[0], salePlan, baseYear, ... }`), `intermediates`(`{ is1Se1House, householdHouseCount }`) |
| 출력 | `boolean` (4개 조건 모두 true이면 `true`, 하나라도 false이면 `false`) |
| 산식 | (1) `condition1 = (caseData.householdHouseCount >= 2)`. (2) `condition2 = (caseData.houses[0].saleRegulated === true)`. (3) `condition3 = (caseData.salePlan.saleDate >= tax_rules.APPLICABLE_SALE_DATE_FROM)`. (4) `condition4 = (intermediates.is1Se1House === false)`. (5) `return (condition1 && condition2 && condition3 && condition4)`. |
| 절사 | 해당 없음 (boolean 반환) |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 예외 | (a) `caseData.houses[0]` 미존재 시 throw. (b) `caseData.salePlan.saleDate` 파싱 실패 시 throw (단계 0 validateCaseData에서 사전 차단되어야 함). |
| 호출 위치 | 단계 4 진입 직전 (§5-2-2 단계 4의 첫 번째 단계) |
| issueFlag 발동 | 본 함수 자체는 issueFlag 발동 책임 없음. 결과를 `collectIssueFlags`가 사용해 분기 (§6-2) |

> **조건 3 재확인 이유 (명세서 §3-1 그대로)**: 단계 0 `validateCaseData`에서 `saleDate < APPLICABLE_SALE_DATE_FROM`은 `OUT_OF_V01_SCOPE_DATE` warning만 발동하고 산출은 진행한다. 단계 4 진입 직전에 양도일을 다시 확인하여, 유예 기간 내 양도는 중과 미적용으로 처리.

> **조건 2 사용자 입력 의존**: `saleRegulated`는 v0.3-A 사용자 직접 입력 (자동 판정 미적용 — 명세서 §B-033 인계). issueFlag `SALE_REGULATED_USER_INPUT` (info)이 항상 발동되어 사용자에게 명시.

> **단락 평가 권장**: 4개 조건의 평가 비용 차이(condition1·2·4는 단순 비교, condition3은 날짜 비교)를 고려하면 비용 낮은 조건부터 단락 평가하는 구현이 효율적. 단, 결과는 동일하므로 구현 자유.

> **회귀 안전성 (v0.1·v0.2 골든셋)**: TC-001~005 (v0.1, `householdHouseCount = 2` 패치 후) 5건 모두 `saleRegulated = false` (v0.1 명세서 §1 단일주택 단순 양도 가정) → condition2 false → 본 함수 false 반환 → 단계 4·9 v0.2.1 분기 진입 → v0.1 결과 100% 보존. TC-006~010 (v0.2 비과세·다주택 케이스) 5건 모두 `saleRegulated = false` 또는 `is1Se1House = true` → 본 함수 false 반환 → v0.2.1 결과 100% 보존.

### 5-6. 단계 10 — `applyTotalTax(calculatedTax, ...)` (v0.3-A 의미 확장)

#### 5-6-1. v0.2.1 → v0.3-A 변경 요약

함수 시그니처·본문 산식 변경 없음 (산출세액을 그대로 totalTax에 반영). 단계 9의 `calculatedTax`가 중과 분기 결과를 이미 반영하고 있으므로, 단계 10은 **추가 분기 없이** v0.2.1 그대로 동작.

> **단계 10이 v0.3-A 변경 영향 영역에 포함된 이유**: v0.3-A 명세서 §0-1 변경 요약 표에서 단계 10이 "의미 확장"으로 명시된 것은, `calculatedTax`가 중과 분기 결과를 이미 포함한다는 의미적 변경을 강조하기 위함이다. 함수 본문은 변경 없음.

### 5-7. 단계 11·12·13 — v0.2.1 그대로 (변경 없음)

v0.2.1 모듈 스펙 그대로 (단계 11: 지방소득세 산출, 단계 12: 총세액 합산, 단계 13: 결과 객체 조립).

> **v0.3-A 영향**: 단계 13 결과 객체 조립 시 `result.steps`에 v0.3-A 신규 4종 필드(§4-2-2)를 추가로 채운다. 본문 산식은 변경 없음.

---

## 6. 자체검증 함수 계약

### 6-1. `selfTest()` (v0.3-A 보강)

| 항목 | v0.2.1 | v0.3-A |
|---|---|---|
| 입력 | 없음 | 동일 |
| 출력 | `{ ok, taxRulesSelfTest, sanityChecks }` | 동일 |
| Sanity 체크 케이스 | TC-001·TC-003·TC-005 (v0.1) + TC-006·TC-008·TC-010 (v0.2) 권장 | + **TC-011 (보유 ≥ 2년 + 2주택 중과 누진세율 재계산)** + **TC-012 (보유 ≥ 2년 + 3주택 이상 중과)** 권장 추가 |
| 부수효과 | 없음 (실패해도 throw 안 함) | 동일 |

> **권장 sanity 케이스 사유**: 부트스트랩 시점에서 v0.3-A 핵심 분기(중과 누진세율 동적 재계산 + 가산세율 룩업)가 작동하는지 즉각 검증. TC-011 (286,616,000) + TC-012 (339,141,000) 정답값은 5/2 검증 통과. 단, 부트스트랩 부담이 있으므로 채택 여부는 작업지시서 05에서 최종 결정 (§11 보류 항목 2번 갱신).

> **v0.1·v0.2 회귀 안전성**: v0.1 골든셋 TC-001~005 + v0.2 골든셋 TC-006~010은 v0.3-A에서 그대로 회귀 통과해야 한다 (명세서 §9). 입력 패치(`householdHouseCount: 2` 추가, 명세서 §9-1)는 v0.2.1에서 이미 적용됨.

### 6-2. `collectIssueFlags(caseData, intermediates)` (v0.3-A 보강)

`collectIssueFlags`는 자체검증 함수가 아니라 **issueFlag 수집 함수**다. 자체검증과 분리해서 구현한다.

v0.3-A에서는 발동 조건이 **25종**으로 확장되었다 (v0.2.1 18종 + v0.3-A 신규 5종 + 보조 3종 − 폐기 1종). 정확한 발동 조건은 명세서 §6 (issueFlag 카탈로그) 참조. 본 문서는 카탈로그를 재정의하지 않고 **§6-A에서 v0.3-A 변경분만** 명시한다.

#### 6-2-1. `intermediates` 입력 보강 (v0.2.1 + v0.3-A 신규 3종)

v0.2.1 §6-2-1 표 그대로 + v0.3-A 신규 3종 추가:

| 필드 | 출처 | 용도 (v0.3-A 신규) |
|---|---|---|
| **`isHeavyTaxation`** | 단계 4 | `HEAVY_TAXATION_APPLIED`·`HEAVY_TAXATION_2_HOUSES`·`HEAVY_TAXATION_3_HOUSES`·`LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY`·`HEAVY_TAX_SHORT_TERM_COMPARISON`·`HEAVY_TAX_EXCLUSION_NOT_HANDLED` 분기 |
| **`heavyRateAddition`** | 단계 4 | `HEAVY_TAXATION_APPLIED` 메시지 채움 (가산세율 +N%p) |
| **`holdingPeriodBranch`** | 단계 8 | `HEAVY_TAX_SHORT_TERM_COMPARISON` 분기 (`!== 'over2y'` 시 발동) |

> v0.2.1까지 활성화된 5종(`is1Se1House`·`isHighValueHouse`·`terminateAt2`·`appliedDeductionTable`·`holdingYears`·`residenceYears`)은 그대로 사용.

#### 6-2-2. `caseData` 직접 사용 항목 (v0.3-A 추가)

| 필드 | 용도 (v0.3-A 신규) |
|---|---|
| `caseData.houses[0].saleRegulated` | `SALE_REGULATED_USER_INPUT` (info, 항상 발동 — `saleRegulated`가 사용자 입력이라는 점 표면화) |
| `caseData.householdHouseCount` | `HEAVY_TAXATION_2_HOUSES`·`HEAVY_TAXATION_3_HOUSES` 분기 (`=== 2` vs `>= 3`) |

### 6-A. v0.3-A issueFlag 카탈로그 변경분

v0.3-A의 issueFlag 카탈로그는 명세서 §6 정본을 참조한다. 본 모듈 스펙은 **변경분만 명시**.

#### 6-A-1. 신규 5종 (중과 핵심)

| 코드 | 발동 조건 (intermediates 기준) | severity | 비고 |
|---|---|---|---|
| `HEAVY_TAXATION_APPLIED` | `intermediates.isHeavyTaxation === true` | warning | 메시지에 `heavyRateAddition`(+20%p 또는 +30%p) 채움 |
| `HEAVY_TAXATION_2_HOUSES` | `isHeavyTaxation && householdHouseCount === 2` | info | — |
| `HEAVY_TAXATION_3_HOUSES` | `isHeavyTaxation && householdHouseCount >= 3` | info | — |
| `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` | `isHeavyTaxation && holdingYears >= 3` | info | 보유 < 3년 케이스는 v0.2.1 `_HOLDING_LESS_THAN_3Y_FOR_TABLE_2`와 별개 사유이므로 본 코드 미발동 |
| `HEAVY_TAX_SHORT_TERM_COMPARISON` | `isHeavyTaxation && holdingPeriodBranch !== 'over2y'` | info | §5-A-9-2 max 비교 트레이스 |

#### 6-A-2. 보조 신규 3종

| 코드 | 발동 조건 | severity | 비고 |
|---|---|---|---|
| `SALE_REGULATED_USER_INPUT` | 항상 (= true) | info | 사용자 직접 입력 책임 명시. v0.3-A 자동 판정 미적용 (B-033 인계) |
| `HEAVY_TAX_EXCLUSION_NOT_HANDLED` | `isHeavyTaxation === true` | info | 시행령 제167조의10·11 단서(장기임대주택 등 중과 배제 사유) v0.3-A 미처리. 전문가 검토 필요 |
| `HEAVY_TAX_TRANSITION_NOT_HANDLED` | `isHeavyTaxation === true && saleDate < SOME_TRANSITION_DATE` | info | 추가 경과조치 미처리 시 발동. v0.3-A는 단일 임계(`APPLICABLE_SALE_DATE_FROM = "2026-05-10"`)만 처리 |

#### 6-A-3. 폐기 1종 (v0.2.1 → v0.3-A)

| 코드 | 폐기 사유 |
|---|---|
| `OUT_OF_V01_SCOPE_REGULATED_AREA` | v0.3-A에서 `saleRegulated`가 활성 입력으로 전환되었으므로 "v0.1 범위 외" 의미 소멸. `SALE_REGULATED_USER_INPUT`(info)으로 대체 |

#### 6-A-4. v0.2.1 계승 18종

v0.2.1 §6 카탈로그 18종 그대로 (명세서 §6 정본 참조). 본 문서에서 재정의 없음.

#### 6-A-5. 활성 카탈로그 합계

`v0.2.1 18종 + v0.3-A 신규 5종 + 보조 3종 − 폐기 1종 = 활성 25종`

> **명세서 §3-6 카운팅과의 정합성**: 명세서 §3-6에서는 "신규 5종 + 보조 3종 = 8종 신규" 표기와 폐기 1종을 포함해 순증 7종으로 계산. 본 문서 카운팅(활성 25종 = v0.2.1 18종 − 폐기 1종 + 신규 8종)과 동일 (검산: 18 − 1 + 8 = 25).

> **`caseData` 시스템 프롬프트의 "신규 7종" 표기와의 차이**: 시스템 프롬프트 일부 위치는 "신규 7종"으로 표기되어 있으나, 명세서 §3-6 정본은 "신규 5종 + 보조 3종 = 8종 신규 (폐기 1 포함 시 순증 7)"이다. 본 모듈 스펙은 명세서 정본을 채택.

---

## 7. 불변성 약속 (v0.2.1 + v0.3-A 추가)

v0.2.1 §7 그대로:

- 호출자는 `window.TaxOpt.taxEngine`이 노출하는 객체를 변경하지 않는다.
- `calculateSingleTransfer`는 입력 `caseData`를 변경하지 않는다 (검증 대상).
- 13단계 각 함수와 v0.2 신규 보조 함수 3종은 입력값을 변경하지 않는다.
- 본 모듈은 `Object.freeze`를 적용하지 않는다 (v0.3 시나리오 엔진 도입 시 모듈 격리 요구 검토).
- 본 모듈은 DOM에 접근하지 않는다.
- 본 모듈은 외부 라이브러리에 의존하지 않는다.

**v0.3-A 추가**:

- v0.3-A 신규 함수 `isHeavyTaxationApplicable(caseData, intermediates)`도 입력값을 변경하지 않는다.
- 단계 4가 받는 `intermediates`(단계 2·3 산출분)도 본문에서 변경되지 않는다.
- v0.3-A 신규 4종 `result.steps` 필드(`isHeavyTaxation`·`heavyRateAddition`·`shortTermTax`·`heavyProgressiveTax`)도 결과 조립 시 1회 설정 후 변경되지 않는다.

---

## 8. 의존성

| 의존 | 종류 | v0.3-A 변경 |
|---|---|---|
| `window.TaxOpt.taxRules` | TaxOpt 모듈 (선행 로드 필수) | **v0.3-A 신규 룩업·함수 추가 의존** (§8-1) |
| 외부 라이브러리 | 없음 | 동일 |
| DOM | 사용 없음 | 동일 |
| 전역 부수효과 | `window.TaxOpt.taxEngine` 등록만 | 동일 |

### 8-1. tax_rules.js 사용 항목 (v0.3-A 정본, 26종)

v0.2.1 §8-1 사용 항목(15종)에 v0.3-A 신규 의존(2종)을 추가하고, **v0.2.1 별칭 4종은 영구 제거** (인계 2 처리).

#### 8-1-1. v0.2.1 계승 + 별칭 영구 제거

v0.2.1 §8-1 정본 명칭 15종은 그대로 사용:

| 사용 멤버 (정본) | 사용 단계 | 형태 | v0.2.1 별칭 (영구 제거) |
|---|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | 단계 6 | number | — |
| `LOCAL_INCOME_TAX_RATE` | 단계 11 | number | — |
| `SHORT_TERM_RATE_UNDER_1Y` | 단계 9 | number | — |
| `SHORT_TERM_RATE_UNDER_2Y` | 단계 9 | number | — |
| `PROGRESSIVE_BRACKETS` | 단계 9 | array | — |
| `findBracket(taxBase)` | 단계 9 | function | — |
| `RULE_VERSION` | 결과 톱레벨 | string | — |
| `APPLICABLE_SALE_DATE_FROM` | 단계 0·4 (§5-5 condition3) | string ("2026-05-10") | — |
| `LAW_REFS` | 결과 톱레벨 | object (heavyTaxation 키 추가) | — |
| `HIGH_VALUE_HOUSE_THRESHOLD` | 단계 2·3 | number = 1,200,000,000 | — |
| `NON_TAXABLE_HOLDING_MIN_YEARS` | 단계 2 | number = 2 | ~~`EXEMPTION_HOLDING_THRESHOLD_YEARS`~~ (영구 제거) |
| `NON_TAXABLE_RESIDENCE_MIN_MONTHS` | 단계 2 | number = 24 | ~~`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`~~ (영구 제거) |
| `LONG_TERM_DEDUCTION_TABLE_1` | 단계 4 (중과 미발동 시) | object[] (13행) | — |
| `LONG_TERM_DEDUCTION_TABLE_2_HOLDING` | 단계 4 (중과 미발동 시) | object[] (8행) | — |
| `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` | 단계 4 (중과 미발동 시) | object[] (9행) | — |
| `findHoldingRate(holdingYears, table)` | 단계 4 (중과 미발동 시) | function | — |
| `findResidenceRate(residenceYears, holdingYears, table)` | 단계 4 (중과 미발동 시) | function | — |

> **별칭 영구 제거 사유 (인계 2)**: v0.2.0~v0.2.1에서 사용 중이던 `EXEMPTION_*_THRESHOLD_*` 별칭은 v0.3-A에서 영구 제거. 코드·테스트·문서 모두 정본 명칭 `NON_TAXABLE_*_MIN_YEARS` / `NON_TAXABLE_*_MIN_MONTHS`만 사용. tax_rules.md v0.3-A §8-1에서 동일 결정.

#### 8-1-2. v0.3-A 신규 의존 (2종)

| 사용 멤버 | 사용 단계 | 형태 | 비고 |
|---|---|---|---|
| **`HEAVY_TAX_RATE_ADDITION`** | 단계 4·9 (가산세율 룩업) | **`object[]` 룩업 테이블 (2행: 2주택 +20%p, 3주택 이상 +30%p)** | 명세서 §3-2-1 그대로. 산식 형태(`(houseCount−1) × 0.10`) 금지 (단일 소스 원칙) |
| **`findHeavyTaxRateAddition(houseCount)`** | 단계 4·9 | **function** | 룩업 + 클램프 (≥3 → 0.30, <2 → throw) |

> **`findHeavyTaxRateAddition`의 클램프 정책 (tax_rules.md §4-A 정본)**: `houseCount === 2`이면 0.20 반환. `houseCount >= 3`이면 0.30 반환 (3주택·4주택·100주택 모두 동일). `houseCount < 2`(또는 비정수)이면 throw.

> **호출 측의 사전 차단 (방어선 이중)**: `tax_engine.js` 단계 4·9에서 `findHeavyTaxRateAddition`을 호출하기 전에 반드시 `isHeavyTaxationApplicable(...) === true`로 분기. 이 분기 내부 condition1(`householdHouseCount >= 2`)이 사전 차단 역할이므로 `findHeavyTaxRateAddition`의 throw 도달은 정상 흐름에서 발생하지 않음. throw는 코드 결함 검출용 방어선.

#### 8-1-3. tax_engine.js 직접 보유 금지 항목 (v0.3-A 단일 소스 원칙)

다음은 모두 `tax_rules.js` 정본 데이터이며 `tax_engine.js`는 보유 금지 (명세서 §0-1 원칙 (1)·(2)):

- 가산세율 숫자 `0.20`·`0.30` (`HEAVY_TAX_RATE_ADDITION` 룩업 호출만 허용)
- 다주택 임계 `2`·`3` (단, `>= 2` 비교는 단계 4 분기 흐름의 일부이므로 산식 흐름으로 허용)
- 중과 시행일 `"2026-05-10"` (`APPLICABLE_SALE_DATE_FROM` 호출만 허용)
- 누진세율표 + 가산세율 합산표 (명세서 §3-4-2 표는 검증 보조용, 코드 보유 금지)
- 중과 baseTax 누적 표 (명세서 §3-4-3 표는 검증 보조용, 코드 보유 금지 — `PROGRESSIVE_BRACKETS` + addition으로 산식 흐름 도출)

### 8-2. 부트스트랩 가드 (v0.2.1 + v0.3-A 신규)

#### 8-2-1. v0.2.1 가드 (그대로)

`calculateSingleTransfer`의 진입부에서 v0.2.1 가드 그대로 실행:

```js
if (!window.TaxOpt || !window.TaxOpt.taxRules) {
  throw new Error('tax_engine: tax_rules.js가 먼저 로드되어야 합니다.');
}
if (typeof window.TaxOpt.taxRules.HIGH_VALUE_HOUSE_THRESHOLD === 'undefined') {
  throw new Error('tax_engine v0.2: tax_rules v0.2 (장특공 표·12억 임계 등) 미로드.');
}
```

#### 8-2-2. v0.3-A 신규 가드 (가드 2-A)

`tax_rules.js`의 v0.3-A 신규 의존 2종 미로드 시 명시적으로 차단:

```js
if (typeof window.TaxOpt.taxRules.HEAVY_TAX_RATE_ADDITION === 'undefined' ||
    typeof window.TaxOpt.taxRules.findHeavyTaxRateAddition !== 'function') {
  throw new Error('tax_engine v0.3-A: tax_rules v0.3-A (다주택 중과 가산세율 룩업) 미로드.');
}
```

> **가드 추가 사유**: `tax_rules.js`가 v0.2.1 상태로 남고 `tax_engine.js`만 v0.3-A로 갱신된 경우, 단계 4·9 중과 분기 진입 시 `tax_rules.findHeavyTaxRateAddition is not a function` 오류로 silent failure가 발생할 수 있음. 부트스트랩 시점에 명시적으로 차단하여 즉각 표면화 (명세서 §0-1 원칙 (1) 단일 소스 보호).

> **tax_rules.md v0.3-A §8-3 정본**: 본 가드는 tax_rules.md v0.3-A §8-3 (의존성 — 부트스트랩 가드)에서 동일 사양으로 명시. 두 모듈 스펙은 가드 사양 일치.

> **회귀 안전성**: 가드 자체는 부트스트랩 시점 1회 실행이며, 이후 단계 호출 흐름에 영향 없음. v0.1·v0.2 골든셋 회귀에 영향 없음.

---

## 9. 비책임 (out of scope, v0.2.1 베이스 + v0.3-A 갱신)

본 모듈은 다음을 **수행하지 않습니다**. 모두 다른 모듈 또는 후속 버전의 책임입니다.

| 영역 | 책임 위치 | v0.3-A 변경 |
|---|---|---|
| 입력값 UI 수집 | `js/input_collector.js` | v0.3-B 예정 |
| 결과 화면 렌더링 | `result.html` | v0.3-A 후속 (별도 작업 창) |
| 시나리오 비교 (양도 전·후 자산 구성) | `js/scenario_engine.js` | **v0.3-B (B-024)** |
| ~~다주택 중과 (제104조 ⑦)~~ | ~~v0.3~~ | **v0.3-A에서 활성화** ✅ |
| 일시적 2주택 정확 산정 (제155조 단서) | post-MVP | issueFlag `ONE_TIME_2HOUSES_NOT_APPLIED`(info)로 명시 |
| 다주택 중과 배제 사유 (시행령 제167조의10·11 단서, 장기임대주택 등) | post-MVP (B-019·B-020) | **v0.3-A 미처리** — issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED`(info)로 명시 (인계 4) |
| 다주택 중과 추가 경과조치 (`APPLICABLE_SALE_DATE_FROM` 외 임계) | post-MVP | issueFlag `HEAVY_TAX_TRANSITION_NOT_HANDLED`(info)로 명시 |
| 자동 조정대상지역 판정 (`saleRegulated` 자동) | post-MVP (B-033) | v0.3-A는 사용자 직접 입력 가정. issueFlag `SALE_REGULATED_USER_INPUT`(info, 항상 발동)로 명시 |
| 장기임대주택 특례 (제155조 등) | post-MVP | — |
| 부담부증여·상속·증여 취득 산정 | 제외 (PRD 1.1) | — |
| 미등기양도자산 70% 세율 | 제외 (PRD 1.1) | issueFlag만 |
| `result.steps` 객체 구조 표준화 (B-032) | post-v0.3-A | v0.3-A는 v0.2.1 패턴 그대로 계승 (인계 1) |

> **인계 4 강조 (시행령 제167조의10·11 단서)**: v0.3-A는 다주택 중과 본문(제104조 ⑦)만 활성화하고, 시행령의 중과 배제 사유(장기임대주택·감면주택·1세대1주택 일시적 등)는 미처리. 사용자가 해당 사유에 해당하는 케이스는 `HEAVY_TAX_EXCLUSION_NOT_HANDLED` info를 통해 명시적으로 안내. tax_rules.md v0.3-A §11-6 TR-10에서 동일 인계.

> **인계 1 강조 (B-032 결과 객체 구조)**: 결과 객체 톱레벨·`result.steps` 필드 구조의 표준화(스냅샷 구조·중첩 객체 도입 등)는 v0.3-A 범위 외. v0.3-A는 v0.2.1 §4 구조를 그대로 계승하고 신규 4종 필드만 추가.

---

## 10. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1.1 | 2026-04-29 | 초판. 작업 창 #4 산출. 13단계 파이프라인 본문 확정 |
| v0.2.0 | 2026-04-30 | 작업 창 #6 산출. (1) 노출 멤버 3종 신규: `check1Se1HouseExemption`·`calculateHighValuePortion`·`calculateLongTermDeduction`. (2) v0.1 함수 시그니처 유지, 단계 2·3·4 본문 활성. (3) `result.steps`에 v0.2 신규 필드 10종 추가. (4) `terminateAt2=true` 시 후속 단계값 명시 0/null 정책 추가. (5) `tax_rules.js` 의존 6종 추가. (6) issueFlag 카탈로그 18종. |
| v0.2.1 | 2026-05-01 | TC-006~010 검증 통과. `calculateLongTermDeduction` 룩업 호출 패턴 정정. tax_rules.js 정본 룩업 테이블 + `findHoldingRate`·`findResidenceRate` 함수 정본 확정. §11-1 보류 항목 해소. |
| **v0.3-A** | **2026-05-02** | **본 버전. 작업 창 (현재) 산출. (1) 노출 멤버 1종 신규: `isHeavyTaxationApplicable(caseData, intermediates)`. v0.2.1 20종 + 1 = 21종. (2) 단계 4 변경: 다주택 중과 발동 시 `longTermDeduction = 0` 강제 (제95조 ② 단서). 함수 시그니처에 `intermediates` 인자 추가. 출력 필드 2종 추가(`isHeavyTaxation`·`heavyRateAddition`). (3) 단계 9 변경: 중과 적용 + 보유 ≥ 2년 → 누진 구간 누적 세액 동적 재계산. 중과 적용 + 보유 < 2년 → max 비교 (제104조 ⑦ 본문 단서). 출력 필드 2종 추가(`shortTermTax`·`heavyProgressiveTax`). (4) `result.steps`에 v0.3-A 신규 필드 4종 추가 (총 27종). (5) `tax_rules.js` 의존 19종 (v0.2.1 17종 + v0.3-A 신규 2종 — 정본 명칭 기준). 별칭 4종(`EXEMPTION_*_THRESHOLD_*` 등) 영구 제거(인계 2). (6) 부트스트랩 가드 2-A 추가 (`HEAVY_TAX_RATE_ADDITION`·`findHeavyTaxRateAddition` 미로드 차단). (7) issueFlag 카탈로그 25종 (v0.2.1 18 + 신규 5 + 보조 3 − 폐기 1). (8) v0.1·v0.2 회귀 안전성 보존 (TC-001~010 모두 그대로 회귀 통과). (9) **TC-011~014 검증 통과 (5/2 KPI 100%)**.** |

---

## 11. 검증 후 보류 항목

본 모듈 스펙은 다음 항목을 **명세서 검증 완료 후에 확정** 또는 **post-MVP로 인계**한다.

1. ~~`tax_rules.js` v0.2의 노출 형태 (배열 vs 함수)~~ → v0.2.1에서 해소 (룩업 테이블 + 함수 정본).
2. **`selfTest()` sanity 케이스 추가 (TC-006·008·010·**TC-011·TC-012**)**: 부트스트랩 부담 검토 후 채택 여부 결정. 일단 권장으로 표기. (작업지시서 05에서 결정)
3. **`Object.freeze` 적용 여부**: v0.3-B 시나리오 엔진 도입 시 모듈 격리 요구 여부에 따라 결정.
4. **`HOLDING_PERIOD_BOUNDARY` 확장 임계치 (2년·3년·15년 ±3일)**: v0.2.1 §11-4 그대로 (작업지시서 05에서 결정).
5. **`UNREGISTERED_ASSET_ASSUMED_FALSE` → `UNREGISTERED_RATE_NOT_APPLIED` 이름 변경**: v0.2.1 §11-5 그대로.
6. **(v0.3-A 신규) `isHeavyTaxationApplicable` 인자 시그니처**: 본 문서는 `(caseData, intermediates)` 시그니처를 채택. `intermediates` 누락 시(단순 호출 시) 단계 2 결과를 `calculateSingleTransfer` 진입부에서 재구성하여 전달. 단순 호출 시그니처(`(caseData)`만 받고 내부에서 단계 2 호출) 채택 여부는 작업지시서 05에서 검토 (현재는 재구성 패턴 권장 — 단계 2 중복 호출 방지).
7. **(v0.3-A 신규, 인계 4)** **시행령 제167조의10·11 단서 처리**: v0.3-A는 미처리. v0.4 또는 후속 작업 창에서 활성화 여부 검토. issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED`(info)로 명시 인계.
8. **(v0.3-A 신규, 인계 3)** **옵션 (가) 동적 재계산 vs 옵션 (나) 별도 누진세율표**: 명세서 §0-1 옵션 (가)(`HEAVY_TAX_RATE_ADDITION` 룩업 + 동적 재계산) 채택. 옵션 (나)(별도 누진세율표 3개) 비채택. 변경 시 본 모듈 §5-A-9-1 산식 흐름 + tax_rules.md §3-A 룩업 테이블 동시 갱신 필요.

---

## 부록 A. 자체 검증 결과 (v0.3-A 모듈 스펙)

본 모듈 스펙(tax_engine.md v0.3-A) 작성 후 다음 5건을 자체 검증한다 (Gim 사용자 시스템 프롬프트 §3 객관적·비판적 관점, 의사결정 #11 정확성 우선).

### A-1. 백로그 정합성

본 모듈 스펙이 처리하는 영역과 백로그 항목의 정합성:

| 백로그 ID | 영역 (정본 — docs/98_backlog.md 본문 정독) | v0.3-A 처리 |
|---|---|---|
| B-008 | 시나리오 비교 지표 결정 (세후 매각금액 1순위의 한계) | ⏳ v0.3-B 시나리오 엔진 영역 (본 모듈 무관) |
| B-009 | validateCaseData 에러 메시지 단축형 필드명 노출 | ⏳ post-MVP (본 모듈 무관) |
| B-019 | validateCaseData 에러 메시지 단축형 노출 | ⏳ post-MVP (본 모듈 무관) |
| B-020 | 의사결정 #5 강화 (법령 개정 대응 아키텍처) | ✅ §1-2 §0-1 인용으로 처리 |
| B-021 | 법제처 OpenAPI 활용 검토 (법령 개정 대응 자동화) | ⏳ post-MVP |
| B-022 | 양도소득세 정수 처리 (절사 vs 반올림) 정당성 확인 후 산식 정정 | ✅ v0.2.1 §7-3 그대로 (v0.3-A 무영향) |
| B-023 | 양도소득세 부칙·경과규정 본격 반영 | ⏳ post-MVP (issueFlag HEAVY_TAX_TRANSITION_NOT_HANDLED) |
| B-024 | 일시적 2주택 비과세 임계 본격 처리 (시행령 제155조 ①) | ⏳ post-MVP (v0.3-A 명세서 §1-4 미포함) |
| B-032 | 결과 객체 구조 명세 vs 실제 코드 불일치 | ⏳ v0.3-A 범위 외 (인계 1, v0.2.1 §4-1·§4-2 패턴 계승) |
| B-033 | 조정대상지역 자동 판정 + 행안부 도로명주소 API 연동 | ⏳ post-MVP (issueFlag SALE_REGULATED_USER_INPUT, B-021 통합) |

검증 결과: **정합** (v0.3-A 단일 책임 영역만 처리, 인계 영역은 issueFlag로 명시 안내).

### A-2. 명세서 인용 정합성

본 모듈 스펙의 v0.3-A 변경 산식이 명세서 §3과 100% 일치하는지 확인:

| 본 문서 위치 | 명세서 위치 | 일치 |
|---|---|---|
| §5-5 `isHeavyTaxationApplicable` 4조건 | §3-1 평가 함수 | ✅ |
| §5-2-2 단계 4 중과 시 `longTermDeduction = 0` | §3-3-1 단계 4 변경 표 | ✅ |
| §5-A-9-1 중과 누진세율 동적 재계산 산식 | §3-4-1 산식 + §3-4-3 누적 표 | ✅ (검증 예시 일치) |
| §5-A-9-2 보유 < 2년 + 중과 max 비교 | §3-5-2 산식 | ✅ |
| §4-2-2 신규 4종 필드 | §3-7 결과 객체 신규 필드 표 | ✅ |
| §6-A issueFlag 카탈로그 25종 | §6 카탈로그 | ✅ (활성 25종 = 18 − 1 + 8 검산) |
| §8-1-2 `HEAVY_TAX_RATE_ADDITION` 룩업 의존 | §3-2-1 룩업 테이블 + §3-2-2 함수 | ✅ |
| §8-2-2 부트스트랩 가드 2-A | tax_rules.md v0.3-A §8-3 | ✅ (가드 사양 일치) |

검증 결과: **정합**.

### A-3. v0.2.1 회귀 안전성

v0.1·v0.2 골든셋(TC-001~010)이 v0.3-A에서 그대로 회귀 통과하는지 검증:

| 케이스 | `householdHouseCount` | `saleRegulated` | `is1Se1House` | 중과 발동 여부 | v0.3-A 결과 |
|---|---|---|---|---|---|
| TC-001~005 (v0.1 골든셋, `householdHouseCount: 2` 패치 후) | 2 | false | false | false (condition2 false) | v0.1 결과 100% 보존 |
| TC-006 (1세대1주택 비과세, salePrice ≤ 12억) | 1 | false | true | false (condition1·4 false) | v0.2.1 결과 100% 보존 |
| TC-007 (1세대1주택 12억 초과 안분) | 1 | false | true | false (condition1·4 false) | v0.2.1 결과 100% 보존 |
| TC-008·009 (다주택 표 1) | 2 | false | false | false (condition2 false) | v0.2.1 결과 100% 보존 |
| TC-010 (일시적 2주택 issueFlag) | 2 | false | false | false (condition2 false) | v0.2.1 결과 100% 보존 (issueFlag 그대로) |

검증 결과: **회귀 안전** (TC-001~010 모두 condition1·2·4 중 하나 이상 false → 본 모듈 §5-5 false 반환 → 단계 4·9 v0.2.1 분기 진입 → v0.2.1 결과 100% 보존).

### A-4. v0.3-A 신규 영역 검증

v0.3-A 신규 케이스 4건의 산출세액이 본 모듈 스펙 산식으로 정확히 도출되는지 확인:

| 케이스 | 보유 | 가구 주택 수 | 가산세율 | 본 문서 산식 | 명세서 정답값 | 일치 |
|---|---|---|---|---|---|---|
| TC-011 (보유 5년, 2주택 중과, taxBase 477,500,000) | over2y | 2 | +20%p | §5-A-9-1 → 260,560,000 + 단계 11 지방소득세 26,056,000 → totalTax 286,616,000 | **286,616,000** | ✅ |
| TC-012 (보유 6년, 3주택 중과, taxBase 477,500,000) | over2y | 3 | +30%p | §5-A-9-1 → 308,310,000 + 단계 11 지방소득세 30,831,000 → totalTax 339,141,000 | **339,141,000** | ✅ |
| TC-013 (보유 5년, 2주택, `saleRegulated: false` — 중과 미발동) | over2y | 2 | null | §5-2-2 중과 미발동 분기 → v0.2.1 산출 그대로 | v0.2.1 정답값 | ✅ (회귀 안전) |
| TC-014 (보유 12년, 3주택, saleRegulated=false, 회귀 보강) | over2y | 3 | null | §5-2-2 중과 미발동 분기 → 다주택 + 보유 12년 → 표 1 24% → v0.2.1 산출 그대로 | TC-008·013 동일 130,878,000 | ✅ (회귀 안전) |

검증 결과: **정합** (5/2 KPI 100% 검증 통과 결과 그대로 채택).

### A-5. 자체 발견 짚을 부분

본 모듈 스펙 작성 중 발견한 3건의 짚을 부분 (사용자 보고 시 명시):

1. **시스템 프롬프트 "신규 7종" vs 명세서 §3-6 "신규 5종 + 보조 3종 = 8종" 카운팅 불일치**: 명세서 §3-6 정본은 "신규 5종 + 보조 3종 = 8종 신규, 폐기 1종 포함 시 순증 7종"이다. 본 모듈 스펙(§6-A-5)은 명세서 정본 표기를 채택. 시스템 프롬프트의 "신규 7종"은 순증 표기로 해석 (활성 25종 = 18 − 1 + 8 검산 일치).

2. **`findHeavyTaxRateAddition(1)` throw — 호출 측 사전 차단의 견고성**: `findHeavyTaxRateAddition`은 `houseCount < 2` 시 throw하나, 호출 측 §5-5 `isHeavyTaxationApplicable` 조건 1(`householdHouseCount >= 2`)이 사전 차단 역할이므로 정상 흐름에서 throw 도달 없음. throw는 코드 결함 검출용 방어선(이중 가드)이며 unreachable 영역. 단계 4·9 본문에서 `findHeavyTaxRateAddition`을 호출할 때는 반드시 `isHeavyTaxation === true` 분기 내부에서만 호출.

3. **`LAW_REFS.heavyTaxation` 라벨에 시행령 제167조의10·11 포함 — 미처리 영역 사용자 혼란 가능성**: tax_rules.md v0.3-A에서 `LAW_REFS.heavyTaxation` 키 추가 시 본문(제104조 ⑦) 외에 시행령(제167조의10·11)을 포함하면, 사용자가 시행령의 중과 배제 사유까지 본 모듈이 처리하는 것으로 오해 가능. 본 모듈은 본문만 처리하며, 시행령 단서는 issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED`(info)로 명시적으로 미처리 영역임을 안내. UI 라벨 표시 시 본문/단서 구분 필요 (v0.3-A 후속 작업 창에서 확인).

4. **`tax_rules.js` 의존 카운팅 정정 (16종 → 19종)**: 본 모듈 작성 인계 정보(요약문)에서는 "v0.2.1 15종 → v0.3-A 16종 사용"으로 인계받았으나, §8-1-1 표를 정본 명칭 기준으로 정확히 카운트하면 **v0.2.1 17종(v0.1 9종 + v0.2 신규 8종) + v0.3-A 신규 2종 = 19종**이다. 본 모듈 §0-1·§10 카운팅을 19종으로 정정. 명세서 §3-6의 "tax_rules.js 노출 멤버 26종" 카운팅은 그대로 유효(영향 없음). 사용 항목 카운팅 차이는 단순 카운팅 오류이며, 코드 작성 시 영향 없음(§8-1-1 표 자체가 정본).

검증 결과: **4건 모두 본문 또는 issueFlag로 명시 처리 완료**. 사용자 보고 시 명시.

---

(끝)
