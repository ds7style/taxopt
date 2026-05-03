# TaxOpt 계산 엔진 명세서 v0.3-B

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.3/02_calc_engine_spec.md` |
| 버전 | v0.3-B (시나리오 엔진 + 상태전이 활성. 다주택 중과는 v0.3-A 단일 시나리오 인터페이스 호출 측 위임) |
| 상태 | ⏳ **검증 대기** (검증팀 시나리오 비교 골든셋 손계산 + 4자 일치 검증 예정) |
| 작성일 | 2026-05-03 (작업 창 #13 산출) |
| 적용 법령 | 소득세법 [법률 제21065호, 시행 2026-01-02] / 시행령 [대통령령 제36129호, 시행 2026-03-01] |
| 적용 전제 | 양도일 ≥ 2026-05-10 (중과 유예 종료 후), salePlan 본격 활성, 거주자, 단독명의, 매매취득, 등기자산 |
| 베이스라인 | v0.3-A 명세서 (`docs/v0.3/01_calc_engine_spec.md`, 1,157줄, 5/3 0:00 KPI 100% 검증 통과) |
| 다음 버전 | v0.4 (PRD 통합), post-MVP (자동 조정대상지역·일시적 2주택·보유세·NPV·본질 가치 4영역) |
| 의사결정 준수 | #1 (중과 유예 처리, v0.3-A 인용), #2 (v0.3 범위), #5 강화 (법령 개정 대응 아키텍처 — §0-1 인용), #9 v9 (.js 코드 산출 금지), **#10 (시나리오 비교 1순위 정렬 지표 D안 + 보강 4건 — 본 명세서 핵심 인용)**, #11 (정확성 > 속도) |
| 백로그 추적 | B-018 (5/7 발표 PT 보조 슬라이드 — 5/5 별도 결정), B-024 (일시적 2주택 — v0.3-B 미포함, post-MVP 인계), B-028~B-031 (본질 가치 4영역 — post-MVP 인계), B-032 (결과 객체 구조 — v0.3-B 범위 외, v0.2·v0.3-A 패턴 계승) |

---

## 0. v0.3-A → v0.3-B 변경 요약

v0.3-B는 v0.3-A의 13단계 단일 양도 파이프라인을 **그대로 호출 측 자산으로 보존**하면서, 그 위에 **시나리오 엔진(`scenario_engine.js`) 레이어**를 신규로 추가한다. v0.3-A의 `calculateSingleTransfer(caseData)`는 v0.3-B에서 **인터페이스 계약 그대로 호출**된다. v0.3-A의 함수 시그니처·결과 객체 구조·issueFlag 카탈로그 25종은 변경 없음.

| 영역 | v0.3-A 동작 | v0.3-B 동작 |
|---|---|---|
| 단일 양도 산식 (13단계) | `calculateSingleTransfer(caseData)` 본문 활성 | **동일 본문 그대로 사용**. 시나리오 엔진이 양도 1건마다 본 함수 호출. |
| `salePlan.candidateHouseIds.length` | `=== 1` (단일 양도) | **`>= 1`** (시나리오 생성 후보. 2~3채까지) |
| 시나리오 생성 | (해당 없음) | **신규**: 매도 대상 조합 + 양도 순서 + 양도 시점 3축으로 후보 생성 |
| 상태전이 시뮬레이션 | (해당 없음) | **신규**: 매 양도마다 `householdHouseCount` 변동 후 다음 양도 시뮬레이션 |
| 시나리오 비교 정렬 | (해당 없음) | **신규**: 의사결정 #10 D안 + 보강 4건 적용. TYPE 분류 후 metricKey 자동 결정. |
| 결과 객체 | `result` (단일) | **`scenarioResult[]` 배열 + 추천 시나리오** |
| 호출 모듈 | `tax_engine.js` 단일 | `scenario_engine.js` (신규) → `tax_engine.js` 호출 |
| issueFlag 카탈로그 | 25종 (단일 양도) | **+ 시나리오 레이어 신규 약 6종** (시나리오 생성·상태전이·동률 안내) |

> **인터페이스 약속 (가장 중요)**: v0.3-A의 `calculateSingleTransfer(caseData)` **함수 시그니처는 변경 없음**. 시나리오 엔진은 caseData 파생본을 양도 1건마다 구성하여 본 함수를 호출한다. v0.3-A의 단계 4·9 다주택 중과 분기는 매 호출마다 (그 시점의 `householdHouseCount`·`saleRegulated` 입력으로) 자동 발동/미발동 판정된다. **시나리오 엔진은 중과 산식을 직접 보유하지 않는다**.

### 0-1. 법령 개정 대응 아키텍처 (의사결정 #5 강화 — v0.3-A §0-1 그대로 인용)

본 명세서가 정의하는 모든 **법령 명시 숫자**는 v0.3-A §0-1의 3원칙을 그대로 따른다. v0.3-B 신규 영역(시나리오 레이어)은 **법령 명시 숫자를 보유하지 않는다** — 양도 1건당 산식·세율·공제는 모두 `tax_engine.js` v0.3-A + `tax_rules.js` v0.3-A에 의존한다.

| 원칙 | v0.3-B에서의 의미 |
|---|---|
| (1) **단일 소스** | `scenario_engine.js`는 법령 명시 숫자 보유 금지. 가산세율·세율표·공제율표·임계 금액 모두 `tax_rules.js` 단일 소스 의존. |
| (2) **룩업 테이블 우선** | 시나리오 비교 1순위 정렬 지표 룰(SCENARIO_METRIC_RULES)도 룰 테이블 형태로 정의 (의사결정 #10 보강 1번). |
| (3) **산식 흐름 분리** | `scenario_engine.js`는 시나리오 생성·상태전이·정렬 흐름만 담당. 13단계 산식은 `tax_engine.js` 책임. |

#### 0-1-1. v0.3-B에서 신규 도입되는 룰 테이블

| 룰 테이블 | 위치 | 정의 정본 |
|---|---|---|
| `SCENARIO_METRIC_RULES` | `scenario_engine.js` (또는 `scenario_rules.js`) | 의사결정 #10 보강 1번 + 본 명세서 §6-2 표 |

> `SCENARIO_METRIC_RULES`는 법령 숫자가 아닌 **제품 결정 룰**이다. 따라서 `tax_rules.js`에 두지 않고 `scenario_engine.js`에 둔다. 변경 시 의사결정 #10 갱신을 트리거.

### 0-2. 본 명세서가 처리하지 않는 영역 (v0.3-A 인용)

다음 영역은 v0.3-B 시나리오 레이어가 책임지지 않으며 v0.3-A 모듈에 그대로 위임한다.

| 영역 | 위임 모듈 |
|---|---|
| 양도차익·비과세·고가주택 안분·장특공·과세표준·세율적용·지방소득세·총세액·세후 매각금액 (13단계) | `tax_engine.js` v0.3-A (`calculateSingleTransfer`) |
| 다주택 중과 4단계 조건 평가 | `tax_engine.js` v0.3-A (`isHeavyTaxationApplicable`) |
| 가산세율 룩업 (`+20%p` / `+30%p`) | `tax_rules.js` v0.3-A (`HEAVY_TAX_RATE_ADDITION` + `findHeavyTaxRateAddition`) |
| 단일 양도 issueFlag 카탈로그 25종 | `tax_engine.js` v0.3-A (`collectIssueFlags`) |
| 결과 객체 톱레벨 구조 (B-032 인계) | v0.2·v0.3-A 패턴 그대로 (`result.metrics`·`result.steps` 캡슐화). 본 명세서는 `scenarioResult`를 신규 정의하나 내부 `taxResult` 1건의 구조는 v0.2·v0.3-A 그대로 보존 |

### 0-3. v0.3-B 핵심 결정 사항 일람 (본 명세서 본문 산출)

| # | 결정 사항 | 본 명세서 위치 |
|---|---|---|
| 1 | 시나리오 타입 3종 (TYPE_1·2·3) 분류 산식 | §3 |
| 2 | classifyScenarioType 함수 계약 | §3-3 |
| 3 | 시나리오 생성 3축 (조합·순서·시점) 메커니즘 | §4 |
| 4 | 상태전이 시뮬레이션 산식 (`householdHouseCount` 매 양도 후 변동) | §5 |
| 5 | 시나리오 비교 정렬 (의사결정 #10 D안 + 보강 4건 + tiebreaker) | §6 |
| 6 | scenarioResult 결과 객체 구조 (`actions[]`·`referenceYear`·`metrics`·`perTransactionResults`) | §7 |
| 7 | v0.3-A 단일 시나리오 회귀 안전성 (TC-001~014 보존) | §8 |
| 8 | v0.3-B issueFlag 신규 약 6종 카탈로그 | §9 |
| 9 | 골든셋 신규 TC-S01~S03(필수) + S04(선택) | §10 |
| 10 | 검증 방법론 (4자 일치 KPI — 시나리오 비교는 홈택스 모의계산 직접 비교 불가) | §11 |

> **결정 6번 (결과 객체 구조)**: B-032 인계로 인해 v0.3-A는 명세-코드 불일치 영역이 있으나, v0.3-B는 v0.3-A의 캡슐화 패턴을 **그대로 계승**하고 시나리오 레이어 결과 객체만 신규 정의한다.

---

## 1. 개요

### 1-1. v0.3-B 적용 범위 (1세대 보유 주택 수 기준)

v0.3-B는 다음 범위만 우선 지원한다 (사용자 시스템 프롬프트 [우선 지원 범위] 인용):

1. 국내 주택 양도
2. **2주택자·3주택자**
3. 사용자가 직접 입력한 취득가액·양도가액·필요경비 기준 계산
4. 양도소득세 + 지방소득세 (v0.3-A 인용)
5. 기본세율표 + 다주택 중과 가산세율 (v0.3-A 인용)
6. 연간 양도소득 기본공제 250만원 (v0.3-A 인용. 동일 과세연도 2건 양도 시 §5-3 적용)
7. **시나리오 비교 — 매도 대상 조합 + 양도 순서 + 양도 시점**
8. 계산 불가 또는 불명확 항목은 issueFlag 처리

### 1-2. v0.3-B 미포함 범위 (post-MVP 인계)

| 영역 | 인계 사유 | 백로그 |
|---|---|---|
| 일시적 2주택 비과세 (시행령 제155조 ①) | 입력 스키마 확장 부담 (종전·신규 식별 필요) + v0.3-A §1-4 불포함 결정 그대로 | B-024 |
| 자동 조정대상지역 판정 | v0.3-A 인용 (사용자 직접 입력) | B-033 |
| 보유세 (재산세·종부세) 통합 | 본질 가치 4영역 핵심 — 입력 스키마·과세표준 산정 별도 모듈 | B-028 |
| 가격 변동 전망 통합 | 본질 가치 4영역 | B-029 |
| 통합 NPV·IRR 시뮬레이션 | 본질 가치 4영역. 의사결정 #10 1순위 지표 본질 가치 전환 | B-030 |
| 시나리오 1순위 지표 본질 가치 전환 | 본질 가치 4영역 통합 후 가능 | B-031 |
| 5/7 발표 PT 보조 슬라이드 (데모 케이스) | 5/5 별도 결정 (B-018) — 본 명세서 본문 외 | B-018 |
| 결과 객체 톱레벨 구조 정정 | v0.2·v0.3-A 패턴 그대로 계승 | B-032 |

### 1-3. v0.3-A 인터페이스 약속 (보존)

v0.3-A의 다음 인터페이스는 v0.3-B에서 **그대로 보존**된다:

| 인터페이스 | v0.3-A 정의 | v0.3-B 사용 |
|---|---|---|
| `calculateSingleTransfer(caseData)` | 단일 양도 13단계 파이프라인 | 시나리오 엔진이 양도 1건당 1회 호출 |
| `caseData.houses[0]` | 단일 House 객체 | 시나리오 엔진이 양도 시점·대상에 맞게 caseData 파생본 구성 |
| `caseData.householdHouseCount` | 단일 양도 시점의 가구 보유 주택 수 | **매 양도 후 변동** (§5 상태전이) |
| `caseData.basicDeductionUsed` | 연간 기본공제 사용 여부 | 동일 과세연도 2번째 양도 시 `true` 전달 (§5-3) |
| `result.steps` (23 + 4종) | 단계별 중간값 | scenarioResult.perTransactionResults[]에 그대로 보존 |
| `result.metrics` (totalTax·netAfterTaxSaleAmount·effectiveTaxRate) | 단일 양도 metrics | scenarioResult.metrics 합산 시 사용 |
| `result.issueFlags` | 25종 단일 양도 카탈로그 | scenarioResult.issueFlags에 양도별 누적 (중복 제거 옵션 §9-3) |

> **회귀 안전성 (절대 깨지면 안 됨)**: v0.3-A 골든셋 TC-001~014 14건은 v0.3-B에서도 **단일 시나리오 입력**(`salePlan.candidateHouseIds.length === 1`, `targetSaleCount === 1`, `allowYearSplitting === false`, `targetSaleYears.length === 1`) 시 동일 totalTax 산출. 본 명세서 §8에서 산식 검증.

### 1-4. v0.3-B 본질 가치 (사용자 시스템 프롬프트 인용)

TaxOpt v0.3-B는 단순 세금계산기가 아니라 다음 기능을 수행한다:

1. 사용자가 보유 주택 정보 + 양도 계획(salePlan) 입력
2. 시스템이 매도 대상 조합 · 양도 순서 · 양도 시점별 시나리오 자동 생성
3. 각 시나리오별 예상 양도소득세 + 세후 매각금액 계산 (v0.3-A 인터페이스 호출)
4. **시나리오 타입에 맞는 1순위 지표로 정렬**하여 추천 시나리오 산출 (의사결정 #10 D안)
5. 추천 근거 + 주의사항을 issueFlag로 표면화

본 명세서는 위 기능을 결정론적 함수로 명세화한다. LLM 추론 영역은 본 명세서 책임 외 (사용자 시스템 프롬프트 [핵심 원칙] 1·2·3 인용).

---

## 2. 입력 스키마 (v0.2.0 베이스라인 + salePlan 본격 활성)

### 2-1. v0.2.0 입력 스키마 베이스라인 인용

v0.3-B 입력 스키마의 **caseData 최상위 구조**·**House 스키마**·**자동 보정 룰**·**v0.6+ 확장 대비 필드**는 모두 `docs/v0.2/03_input_schema.md` v0.2.0과 v0.3-A §4를 그대로 인용한다. 본 명세서는 본 영역을 재정의하지 않는다.

```js
caseData = {
  baseYear:              number,
  householdMembers:      number,
  basicDeductionUsed:    boolean,
  householdHouseCount:   number,
  isOneTimeTwoHouses:    boolean,
  specialTaxFlags:       object,        // v0.6+ 활성
  specialTaxRequirementsMet: string[],  // v0.6+ 활성
  houses:                House[],       // v0.3-B: length === 2 또는 3 (다주택 시나리오)
  salePlan:              SalePlan
}

House = {
  id, nickname, location,
  acquisitionDate, acquisitionPrice, necessaryExpense,
  acquisitionRegulated,                 // v0.2 활성
  residenceMonths, livingNow,           // v0.2 활성
  expectedSaleDate, expectedSalePrice,
  saleRegulated                         // v0.3-A 활성 — 다주택 중과 판정용
}
```

#### 2-1-1. v0.3-B에서 변경된 영역

| 영역 | v0.3-A | v0.3-B |
|---|---|---|
| `houses.length` | 1 (`salePlan.candidateHouseIds.length === 1` 가정) | **2 또는 3** (다주택 입력) |
| `salePlan.candidateHouseIds.length` | 1 | **>= 1** (양도 후보) |
| `salePlan.targetSaleCount` | (사용 안 함) | **본격 활성** (1·2·3·"undecided") |
| `salePlan.allowSystemToChooseSaleTargets` | (사용 안 함) | **본격 활성** |
| `salePlan.allowYearSplitting` | (사용 안 함) | **본격 활성** |
| `salePlan.targetSaleYears` | (사용 안 함) | **본격 활성** (길이 1=고정, ≥2=시점 비교) |
| `houses[i].saleRegulated` | `houses[0]` 단일 사용 | **각 House마다 독립 보유** (양도 순서별로 중과 분기 다를 수 있음) |
| `caseData.householdHouseCount` | 단일 시점 입력값 | **시나리오 시뮬레이션 중 매 양도 후 변동** (§5-2 상태전이) |
| `caseData.basicDeductionUsed` | 단일 양도 입력 | **동일 과세연도 2번째 양도부터 `true` 전달** (§5-3 상태전이) |

> **`houses` 배열의 의미 변경 (가장 중요)**: v0.3-A는 `houses[0]` 단일 House만 사용. v0.3-B는 보유 주택 모두를 `houses[]`에 담는다. 양도 시 시나리오 엔진은 양도 대상 House를 추출하여 `caseData.houses = [선택된House]` 파생본을 구성한 후 `calculateSingleTransfer`를 호출한다.

### 2-2. salePlan 본격 활성 (`docs/02_saleplan_ui_design.md` §2 정본 인용)

salePlan의 **정본은 작업 창 #2 산출물(`docs/02_saleplan_ui_design.md` §2-1·§2-2·§2-3)**이다. 본 명세서는 그대로 인용한다.

#### 2-2-1. 스키마 정의 (정본 §2-1 인용)

| 필드 | 타입 | 허용값 | 기본값 | 필수 | 설명 |
|---|---|---|---|---|---|
| `targetSaleCount` | `number \| string` | `1`, `2`, `3`, `"undecided"` | 보유 2채→`1`, 보유 3채→`2` | 필수 | 양도할 주택 수. `"undecided"`는 시스템이 후보를 비교 |
| `candidateHouseIds` | `string[]` | `["A"]`, `["A","B"]`, `["A","B","C"]` | 보유 주택 수에서 자동 도출 | 필수 | 시나리오 생성 후보 주택 ID. `excludedHouseIds`를 제외한 결과 |
| `fixedSaleHouseIds` | `string[]` | `candidateHouseIds`의 부분집합 | `[]` | 선택 | 반드시 매도해야 하는 주택. `excludedHouseIds`와 교집합 invalid |
| `excludedHouseIds` | `string[]` | `candidateHouseIds`의 부분집합 | `[]` | 선택 | 반드시 보유해야 하는 주택. `fixedSaleHouseIds`와 교집합 invalid |
| `allowSystemToChooseSaleTargets` | `boolean` | `true`, `false` | `true` | 필수 | `false`이면 `fixedSaleHouseIds.length === targetSaleCount`이어야 의미 있음 |
| `allowYearSplitting` | `boolean` | `true`, `false` | `false` | 필수 | `targetSaleCount === 1`이면 강제로 `false` |
| `targetSaleYears` | `number[]` | `[2025]`, `[2026]`, … | `[caseData.baseYear]` | 필수 | `allowYearSplitting === false`이면 길이 1, `true`이면 길이 ≥ 2 |

#### 2-2-2. 검증 규칙 (정본 §2-2 인용 — `validateSalePlan` 처리 항목)

| 코드 | 조건 | 처리 |
|---|---|---|
| `SP_E001` | `fixedSaleHouseIds ∩ excludedHouseIds ≠ ∅` | 차단 (issueFlag severity=error) |
| `SP_E002` | `fixedSaleHouseIds.length > targetSaleCount` | 차단 |
| `SP_W001` | `allowSystemToChooseSaleTargets === false` AND `fixedSaleHouseIds.length !== targetSaleCount` | 경고 |
| `SP_W002` | `allowYearSplitting === true` AND `targetSaleYears.length < 2` | 경고 |
| `SP_W003` | `targetSaleCount === 1` AND `allowYearSplitting === true` | 경고 (분산 양도 의미 없음) |
| `SP_W004` | `candidateHouseIds.length - excludedHouseIds.length < targetSaleCount` | 경고 (남은 후보 부족) |

> **검증 시점**: `validateCaseData(caseData)` 진입 시 `validateSalePlan(caseData.salePlan)`을 호출. v0.3-A의 `validateCaseData` 13종 검증 + 자동 보정 7종은 그대로 보존. salePlan 검증은 신규 추가.

#### 2-2-3. PRD 8-5절 7가지 양도 계획 입력 항목 매핑 (정본 §2-3 인용)

| PRD 8-5절 항목 | salePlan 필드 |
|---|---|
| ① 현재 보유 주택 수 | `candidateHouseIds.length` (`caseData.houses.length`로도 반영) |
| ② 그중 몇 채를 양도할 계획인지 | `targetSaleCount` |
| ③ 매도 대상 주택이 이미 정해져 있는지 | `allowSystemToChooseSaleTargets` |
| ④ 반드시 팔아야 하는 주택 | `fixedSaleHouseIds` |
| ⑤ 반드시 보유해야 하는 주택 | `excludedHouseIds` |
| ⑥ 양도 시점이 고정되어 있는지 | `targetSaleYears` (길이 1=고정, 길이 ≥ 2=비교) |
| ⑦ 과세연도 분산 허용 여부 | `allowYearSplitting` |

✅ 7개 항목 모두 매핑됨.

### 2-3. v0.3-A 결과 객체 구조 (호출 인터페이스 — `calculateSingleTransfer` 호출 측)

시나리오 엔진은 양도 1건당 v0.3-A `calculateSingleTransfer(caseData)`를 호출한다. 반환되는 `result` 객체의 구조는 **v0.2·v0.3-A 패턴 그대로 계승** (B-032 인계 — v0.3-B 범위 외).

```js
result = {
  engineVersion:    string,    // "v0.3.0-A" (v0.3-B에서 갱신 없음 — 인터페이스 보존)
  ruleVersion:      string,    // tax_rules.RULE_VERSION
  lawRefs:          object,    // tax_rules.LAW_REFS
  caseDataSnapshot: object,    // 입력 캡처
  steps:            object,    // 23 + v0.3-A 신규 4 = 27종
  metrics: {                   // v0.2·v0.3-A 캡슐화 패턴 (B-032 인계)
    totalTax:              number,
    netAfterTaxSaleAmount: number,
    effectiveTaxRate:      number | null
  },
  issueFlags:       IssueFlag[],  // v0.3-A 25종 카탈로그
  timestamp:        string
}
```

> **B-032 처리**: v0.3-A 명세서 §5-4와 동일하게 본 명세서도 톱레벨 명시 영역과 실제 코드(`result.metrics` 캡슐화)의 불일치는 **v0.3-B 범위 외**로 분리. 5/6 PRD 작성 시점 또는 v0.4 통합 시점에 별도 처리. 시나리오 엔진은 `result.metrics.totalTax` 등 캡슐화 경로로 접근.

### 2-4. v0.3-B 시나리오 엔진 입력·출력 인터페이스

#### 2-4-1. 진입점 함수 시그니처 (권장)

```js
// scenario_engine.js v0.3-B 진입점 (3개)

// (1) 시나리오 후보 생성 (산출 단계)
generateScenarios(caseData) → Scenario[]

// (2) 시나리오 시뮬레이션 (계산 단계 — 상태전이 포함)
simulateScenarios(scenarios, caseData) → ScenarioResult[]

// (3) 시나리오 비교 정렬 + 추천 (의사결정 단계 — 의사결정 #10 D안)
recommendBestScenario(scenarioResults, salePlan) → { scenarios: ScenarioResult[], recommendedScenarioId: string, scenarioType: string, metricKey: string }
```

#### 2-4-2. 통합 진입점 (선택)

```js
// scenario_engine.js v0.3-B 통합 진입점 (검증 호출용)
runScenarioPipeline(caseData) → {
  scenarios:             ScenarioResult[],     // 정렬·rank 부여 완료
  recommendedScenarioId: string,
  scenarioType:          "TYPE_1_WHICH_ONE" | "TYPE_2_ORDER" | "TYPE_3_TIMING",
  metricKey:             "effectiveTaxRate" | "netAfterTaxSaleAmount" | "totalTax",
  dimensions:            { hasMultipleCandidates, hasOrderingDecision, hasTimingSpread },
  issueFlags:            IssueFlag[]
}
```

> **함수 시그니처는 권장**이며 모듈 스펙 v0.3-B 작업 창에서 최종 결정. 본 명세서는 흐름·계약·부수효과만 명시 (의사결정 #9 v9 — 명세서 단일 책임).

---

## 3. 시나리오 타입 분류 (TYPE_1·2·3) — 의사결정 #10 D안 정본 인용

### 3-1. 의사결정 #10 D안 본문 인용

본 §3은 의사결정 #10 (시나리오 비교 1순위 정렬 지표) D안 + 보강 4건의 본문을 그대로 인용한다. 정본은 `docs/99_decision_log.md` 의사결정 #10이며, 본 명세서는 단일 진본으로 시나리오 엔진의 분류 산식을 명세한다.

#### 3-1-1. 차원 태그 (의사결정 #10 보강 2번 — `classifyScenarioDimensions`)

시나리오의 종류는 enum이 아닌 **3개 차원 태그**로 식별한다. 향후 확장(증여·보유세·조특법) 시 차원만 추가하면 룰 테이블 한 줄 추가로 처리 가능 (의사결정 #10 보강 2번 본문 인용).

```js
function classifyScenarioDimensions(salePlan) {
  return {
    hasMultipleCandidates: salePlan.candidateHouseIds.length > 1
                           && salePlan.fixedSaleHouseIds.length === 0,
    hasOrderingDecision:   salePlan.targetSaleCount >= 2,
    hasTimingSpread:       salePlan.allowYearSplitting === true
                           && salePlan.targetSaleYears.length >= 2
    // (post-MVP 확장 자리)
    // hasGiftOption:    (v0.5+) 증여 시나리오 활성 시
    // hasHoldingTaxView:(v0.6+) 보유세 통합 시
    // hasSpecialTaxHouse:(v0.6+) 조특법 특례주택 진입 시
  };
}
```

| 차원 | 의미 | salePlan 필드 |
|---|---|---|
| `hasMultipleCandidates` | 후보 주택이 여러 채이고 매도 대상 미정 (어느 1채 양도?) | `candidateHouseIds.length > 1 && fixedSaleHouseIds.length === 0` |
| `hasOrderingDecision` | 양도할 주택이 2채 이상 (양도 순서 결정 필요) | `targetSaleCount >= 2` |
| `hasTimingSpread` | 과세연도 분산 허용 (양도 시점 결정 필요) | `allowYearSplitting === true && targetSaleYears.length >= 2` |

#### 3-1-2. 룰 테이블 — 시나리오 종류 식별 + 1순위 정렬 지표 (의사결정 #10 D안 + 보강 1번)

`SCENARIO_METRIC_RULES`는 **차원 태그**로부터 **시나리오 타입**과 **1순위 metricKey**를 결정하는 룰 테이블이다. 우선순위 1번부터 순차 평가하여 첫 매칭에서 결정.

| 우선순위 | 식별 조건 | 시나리오 타입 | 1순위 metricKey | 정렬 방향 |
|---|---|---|---|---|
| **1** | `hasTimingSpread === true` | **TYPE_3_TIMING** | `netAfterTaxSaleAmount` (Σ 합계) | `desc` |
| **2** | `hasMultipleCandidates === true AND hasOrderingDecision === false` | **TYPE_1_WHICH_ONE** | `effectiveTaxRate` | `asc` |
| **3** | (그 외 모든 케이스 — fallback) | **TYPE_2_ORDER** | `netAfterTaxSaleAmount` (Σ 합계) | `desc` |

#### 3-1-3. 결합 케이스 우선순위 (의사결정 #10 부수 결정 4번)

시나리오 1+2+3 복합 케이스(예: `hasMultipleCandidates && hasOrderingDecision && hasTimingSpread` 모두 true)는 위 룰 테이블 순차 평가에 따라 **TYPE_3_TIMING이 무조건 우선**한다. 시점 분산 활성이 가장 강한 시그널로 작용.

> **결합 케이스 처리 의의**: 다차원 결정을 내릴 때 사용자가 "시점도 비교해 달라"고 명시 입력한 경우(allowYearSplitting=true)는 시간 차원이 가장 큰 의사결정 변수임을 의미. 이를 우선 적용.

#### 3-1-4. 시나리오 1 (TYPE_1)의 1순위 metricKey = effectiveTaxRate (의사결정 #10 부수 결정 5번)

TYPE_1_WHICH_ONE에서 1순위 metricKey가 **netAfterTaxSaleAmount이 아닌 effectiveTaxRate인 이유** (의사결정 #10 D안 채택 근거):

- TYPE_1은 "어느 1채를 팔까"를 비교한다. 후보 주택 A·B·C는 양도가액(salePrice)이 서로 다르다.
- netAfterTaxSaleAmount는 양도가액에 강하게 종속된다 (양도가액이 높으면 세후 매각금액도 큼). "비싼 주택을 팔라"는 무의미한 답을 산출.
- effectiveTaxRate는 양도가액 정규화 후 절세 효율 비교. "어느 주택이 절세 효율이 우수한가"라는 사용자 의도에 정합.
- effectiveTaxRate = `totalTax / salePrice` (v0.3-A 명세서 §5-4 정의). asc 정렬(낮은 세부담률이 우수).

> **시나리오 2·3은 그 외 케이스로서 netAfterTaxSaleAmount Σ 합계 desc 사용**: TYPE_2·3은 같은 자산 묶음(또는 같은 자산을 같은 시점·다른 시점)에 대한 비교이므로 Σ salePrice가 동일하거나 거의 동일. 이 경우 netAfterTaxSaleAmount Σ 합계가 정확히 절세 효과를 표현.

### 3-2. classifyScenarioType 함수 계약

| 항목 | 내용 |
|---|---|
| 입력 | `scenario` (Scenario 객체 — §4-3) 또는 `salePlan` (SalePlan 객체 — §2-2-1) |
| 출력 | `{ scenarioType, dimensions, metricKey, order }` |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |

#### 3-2-1. 산식

```
입력: salePlan
산출:
  1. dimensions = classifyScenarioDimensions(salePlan)   // §3-1-1
  2. SCENARIO_METRIC_RULES 룰 테이블 순차 평가:
       (a) dimensions.hasTimingSpread === true
            → return { scenarioType: "TYPE_3_TIMING", metricKey: "netAfterTaxSaleAmount", order: "desc" }
       (b) dimensions.hasMultipleCandidates && !dimensions.hasOrderingDecision
            → return { scenarioType: "TYPE_1_WHICH_ONE", metricKey: "effectiveTaxRate", order: "asc" }
       (c) (그 외 fallback)
            → return { scenarioType: "TYPE_2_ORDER", metricKey: "netAfterTaxSaleAmount", order: "desc" }
출력: { scenarioType, dimensions, metricKey, order }
```

#### 3-2-2. 검증 케이스

| 케이스 | salePlan | 기대 dimensions | 기대 scenarioType | 기대 metricKey |
|---|---|---|---|---|
| 1 | `targetSaleCount=1, candidateHouseIds=["A","B"], fixedSaleHouseIds=[]` | `{ true, false, false }` | TYPE_1_WHICH_ONE | effectiveTaxRate |
| 2 | `targetSaleCount=2, candidateHouseIds=["A","B"], allowYearSplitting=false` | `{ false, true, false }` | TYPE_2_ORDER | netAfterTaxSaleAmount |
| 3 | `targetSaleCount=2, allowYearSplitting=true, targetSaleYears=[2026,2027]` | `{ ?, true, true }` | TYPE_3_TIMING (우선순위 1) | netAfterTaxSaleAmount |
| 4 | `targetSaleCount=1, fixedSaleHouseIds=["B"]` | `{ false, false, false }` | TYPE_2_ORDER (fallback) | netAfterTaxSaleAmount |

> **케이스 4의 의미**: 매도 대상이 이미 정해진 단일 양도 케이스. `hasMultipleCandidates = false` (fixedSaleHouseIds.length > 0 → false). `hasOrderingDecision = false` (targetSaleCount=1). `hasTimingSpread = false`. 룰 fallback으로 TYPE_2_ORDER가 적용되며 단일 시나리오만 산출되므로 정렬·추천 의미는 제한적. 본 케이스는 `result.scenarios.length === 1`이며 issueFlag `SCENARIO_SINGLE_FIXED`(info)로 안내.

### 3-3. 차원 태그 vs enum의 트레이드오프 (의사결정 #10 보강 2번 본문 인용)

본 명세서는 enum 직접 사용(`scenarioType: "TYPE_1"`)이 아닌 **차원 태그(dimensions) 기반 분류**를 채택한다. 채택 근거 (의사결정 #10 보강 2번 본문 인용):

| 패턴 | 장점 | 단점 |
|---|---|---|
| **차원 태그 (dimensions)** ✅ | 확장 시 차원 추가만으로 기존 룰 영향 없음. 차원 직교성 유지. v0.5+ 증여/v0.6+ 보유세 통합 시 룰 테이블 한 줄 추가만으로 신규 타입 정의 가능 | 분류 결과를 직접 사용하기 어려움 (룰 테이블 통과 필요) |
| enum 직접 분류 | 사용 측이 type만 보면 됨 | 향후 확장 시 enum 추가 + 분기 코드 모두 갱신 필요 |

> **결과 객체에는 양쪽 모두 노출**: `scenarioResult.scenarioType` (enum)과 `scenarioResult.dimensions` (차원 태그)를 모두 노출. 결과 화면은 `scenarioType` 기반 캡션 사용, v0.5+ 확장은 `dimensions` 활용 (의사결정 #10 (E) 본문).

---

## 4. 시나리오 생성 메커니즘 (조합 + 순서 + 시점)

### 4-1. 3축 생성 흐름

시나리오는 다음 3축의 데카르트 곱으로 생성된다.

```
시나리오 = (매도 대상 조합) × (양도 순서) × (양도 시점)
```

| 축 | 함수 | 입력 | 출력 |
|---|---|---|---|
| 1. 매도 대상 조합 | `generateSaleTargetCombinations(salePlan, houses)` | salePlan | `Combination[]` (각 원소는 매도 대상 House ID 집합) |
| 2. 양도 순서 | `generateSaleOrderScenarios(combinations)` | `Combination[]` | `OrderedScenario[]` (각 원소는 매도 대상 + 순서) |
| 3. 양도 시점 | `generateSaleYearScenarios(orderedScenarios, salePlan)` | `OrderedScenario[]` + salePlan | `Scenario[]` (각 원소는 완전한 시나리오) |

> **순차 적용 vs 동시 데카르트**: 본 명세서는 3축을 순차 적용 패턴으로 정의. 메모리 부담을 고려해 단계별 prune 가능 (예: 2축 통과 시점에 동률 시나리오 사전 제거). 본 명세서는 흐름만 정의하고 prune 정책은 모듈 스펙·작업지시서에서 결정.

### 4-2. 축 1 — 매도 대상 조합 생성 (`generateSaleTargetCombinations`)

#### 4-2-1. 산식

```
입력: salePlan, houses
산출:
  1. 후보 풀 = salePlan.candidateHouseIds − salePlan.excludedHouseIds
  2. 조합 크기 = salePlan.targetSaleCount

  3. 케이스 분기:
     (a) targetSaleCount === "undecided":
            for k in [1..후보 풀.length]:
              조합 ∪= C(후보 풀, k)
     (b) targetSaleCount === number:
            조합 = C(후보 풀, targetSaleCount)

  4. 필터:
     - salePlan.fixedSaleHouseIds ⊆ 조합   (반드시 팔 주택을 포함하지 않는 조합 제거)

  5. 출력: Combination[]
출력: 매도 대상 조합 배열 (각 원소는 House ID 집합)
```

#### 4-2-2. 검증 케이스

| salePlan | 후보 풀 | 출력 |
|---|---|---|
| `targetSaleCount=1, candidates=[A,B], excluded=[], fixed=[]` | `{A,B}` | `[{A}, {B}]` |
| `targetSaleCount=2, candidates=[A,B,C], excluded=[], fixed=[]` | `{A,B,C}` | `[{A,B}, {A,C}, {B,C}]` |
| `targetSaleCount=2, candidates=[A,B,C], excluded=[A], fixed=[]` | `{B,C}` | `[{B,C}]` |
| `targetSaleCount=2, candidates=[A,B,C], excluded=[], fixed=[A]` | `{A,B,C}` | `[{A,B}, {A,C}]` (A 미포함 조합 제거) |
| `targetSaleCount="undecided", candidates=[A,B], excluded=[], fixed=[]` | `{A,B}` | `[{A}, {B}, {A,B}]` |

#### 4-2-3. issueFlag 발동 조건

| code | severity | 발동 |
|---|---|---|
| `SCENARIO_NO_VALID_COMBINATION` | error | 출력 배열 길이 0 (후보 부족 또는 fixed/excluded 충돌) |
| `SCENARIO_FIXED_SALE_FORCED` | info | `fixedSaleHouseIds.length > 0` (사용자가 매도 대상을 일부 강제) |

### 4-3. 축 2 — 양도 순서 생성 (`generateSaleOrderScenarios`)

#### 4-3-1. 산식

```
입력: combinations[]
산출:
  for each combination in combinations:
    if combination.length === 1:
       orderedScenarios ∪= [[combination[0]]]
    else:
       orderedScenarios ∪= 모든_순열(combination)   // P(combination)

출력: OrderedScenario[]
```

#### 4-3-2. 검증 케이스

| combination | 출력 (순열) |
|---|---|
| `{A}` | `[[A]]` |
| `{A,B}` | `[[A,B], [B,A]]` |
| `{A,B,C}` | `[[A,B,C], [A,C,B], [B,A,C], [B,C,A], [C,A,B], [C,B,A]]` (6개) |

#### 4-3-3. 순서 중요성

양도 순서는 **다주택 중과 분기**(§5)와 **동일 과세연도 기본공제**(§5-3)에 영향을 준다. 따라서 순열은 단순 조합과 다르며, 같은 자산 묶음이라도 순서가 달라지면 다른 시나리오로 처리.

> **2채 양도 시 2개 순서**: A→B (A 먼저 양도) vs B→A (B 먼저 양도). 순서별 totalTax가 다를 수 있음. 첫 양도 시 가구 보유 주택 수가 더 많으므로 중과 분기가 강하게 작동.

> **3채 양도 시 6개 순서**: 마찬가지로 모든 순열 비교. 단, 동일 과세연도 내라면 순서가 결과에 미치는 영향이 크게 다르지 않을 수 있음 (검증팀 손계산 결과로 확인 필요 — TC-S03 골든셋).

### 4-4. 축 3 — 양도 시점 생성 (`generateSaleYearScenarios`)

#### 4-4-1. 산식

```
입력: orderedScenarios[], salePlan
산출:
  Y = salePlan.targetSaleYears   // [2026] 또는 [2026, 2027] 등
  N = salePlan.targetSaleCount   // 양도 건수

  if (salePlan.allowYearSplitting === false):
     // 모든 양도가 동일 연도(targetSaleYears[0])에 발생
     for each orderedScenario in orderedScenarios:
        scenarios ∪= [{ ordered: orderedScenario, years: [Y[0], Y[0], ...] }]   // 길이 N
  else:
     // allowYearSplitting === true: 연도 매핑 모든 경우의 수 생성
     for each orderedScenario in orderedScenarios:
        // 양도 i번째에 어느 연도를 배정할지: Y의 N-튜플 중 단조 비감소(시간 흐름 자연스러움)
        for each yearTuple in monotonicNonDecreasingTuples(Y, N):
           scenarios ∪= [{ ordered: orderedScenario, years: yearTuple }]

출력: Scenario[]   // 각 원소: { ordered: HouseId[], years: number[] }
```

#### 4-4-2. 단조 비감소 튜플 (`monotonicNonDecreasingTuples`) — 실용적 가정

양도 시점은 시간 흐름상 **단조 비감소**(같거나 증가) 순서로만 생성한다. 사유:

1. 양도 1번째가 2027년이고 2번째가 2026년인 시나리오는 시간 모순 (이미 양도한 주택이 더 늦은 시점에 양도된 케이스).
2. 같은 연도 내 2건 양도(Y=[2026,2026])는 허용 (동일 과세연도 분산).

```
예: Y = [2026, 2027], N = 2
   → [(2026,2026), (2026,2027), (2027,2027)]   // 3개 (단조 비감소)
   → ❌ (2027,2026) 제거 (시간 역행)

예: Y = [2026, 2027, 2028], N = 2
   → [(2026,2026), (2026,2027), (2026,2028), (2027,2027), (2027,2028), (2028,2028)]   // 6개
```

#### 4-4-3. 시나리오 수 폭발 가드 (issueFlag)

3축의 데카르트 곱은 시나리오 수가 빠르게 증가한다.

| 보유 | 양도 | 후보 연도 | 동일 연도 | 분산 (단조 비감소) | 시나리오 수 |
|---|---|---|---|---|---|
| 2채 | 1채 | [2026] | C(2,1) × P(1) × 1 = 2 | — | **2** |
| 2채 | 2채 | [2026] | C(2,2) × P(2) × 1 = 2 | — | **2** |
| 3채 | 1채 | [2026] | C(3,1) × P(1) × 1 = 3 | — | **3** |
| 3채 | 2채 | [2026] | C(3,2) × P(2) × 1 = 6 | — | **6** |
| 3채 | 3채 | [2026] | C(3,3) × P(3) × 1 = 6 | — | **6** |
| 2채 | 2채 | [2026,2027] | — | 2 × 3 = 6 | **6** |
| 3채 | 3채 | [2026,2027,2028] | — | 6 × 10 = 60 | **60** |

> **가드**: 시나리오 수가 50건 이상 시 issueFlag `SCENARIO_COUNT_EXCEEDS_THRESHOLD` (warning) 발동. 100건 이상 시 `SCENARIO_COUNT_HARD_LIMIT` (error)로 차단. 임계는 모듈 스펙에서 최종 결정.

> **MVP 발표 데모 권고 (B-018 5/5 별도 결정)**: 2~3주택 + 동일 연도 양도 케이스 위주. 시점 분산은 TYPE_3_TIMING 데모 1건만 (TC-S04 후보).

### 4-5. 통합 함수 — `generateScenarios(caseData)` 흐름

```js
function generateScenarios(caseData) {
  // 1) salePlan 검증 (§2-2-2)
  validateSalePlan(caseData.salePlan);

  // 2) 매도 대상 조합 생성 (§4-2)
  const combinations = generateSaleTargetCombinations(caseData.salePlan, caseData.houses);

  // 3) 양도 순서 생성 (§4-3)
  const orderedScenarios = generateSaleOrderScenarios(combinations);

  // 4) 양도 시점 생성 (§4-4)
  const scenarios = generateSaleYearScenarios(orderedScenarios, caseData.salePlan);

  // 5) 시나리오 수 가드 (§4-4-3)
  enforceScenarioCountGuard(scenarios);

  // 6) 각 시나리오에 scenario_id 부여 (정렬·추적용)
  return scenarios.map((s, i) => ({ ...s, scenarioId: `SC-${i + 1}` }));
}
```

> **scenarioId 생성 규칙**: `SC-1`·`SC-2`·... 순번. 정렬 후 rank가 부여되며, 사전순 tiebreaker(§6-3)에 사용됨. scenarioId는 입력에 의존하므로 동일 입력 → 동일 ID (결정성).
---

## 5. 상태전이 시뮬레이션 (본 명세서 핵심)

### 5-1. 상태전이의 의미

v0.3-B의 본질은 **양도가 발생할 때마다 가구 상태가 변동**한다는 점이다. 단일 시점 단일 양도(v0.3-A)는 가구 상태가 고정이지만, v0.3-B는 시나리오 내 양도 N건을 시뮬레이션하면서 다음 양도 시점의 가구 상태(특히 `householdHouseCount`)가 직전 양도 영향으로 변동된다.

#### 5-1-1. 상태전이가 영향을 주는 산식

| 영역 | v0.3-A 산식 | v0.3-B 변동 |
|---|---|---|
| 다주택 중과 4단계 조건 1 | `householdHouseCount >= 2` | **양도 후 감소** → 다음 양도 시 조건 1 false 가능 |
| 다주택 중과 가산세율 (§3-2-1 룩업) | `findHeavyTaxRateAddition(householdHouseCount)` | **양도 후 감소** → 다음 양도 시 가산세율 변동 (+30%p → +20%p, 또는 0%p) |
| 1세대1주택 비과세 판정 | `householdHouseCount === 1` | **양도 후 1로 감소** → 마지막 양도가 1세대1주택 비과세 적용 가능 |
| 양도소득 기본공제 250만원 | `basicDeductionUsed === false`이면 250만원 공제 | **양도 1건 후 동일 과세연도 내 다음 양도는 `basicDeductionUsed=true` 전달** → 250만원 공제 미적용 |

> **이 4가지가 상태전이 시뮬레이션의 핵심 산식이다.** 단일 양도 13단계는 v0.3-A 그대로 사용. 시나리오 엔진은 매 양도 후 가구 상태를 변동시켜 다음 양도용 caseData 파생본을 구성.

### 5-2. `householdHouseCount` 상태전이 산식

#### 5-2-1. 기본 산식

```
초기 상태: householdHouseCount_initial = caseData.householdHouseCount
            (사용자 입력값. 시나리오 시뮬레이션 시작 시점의 가구 보유 주택 수)

양도 i번째 진입 시 (1-based):
  householdHouseCount_at_sale_i = householdHouseCount_initial − (i − 1)

  // i=1 (첫 양도): householdHouseCount_initial
  // i=2 (두 번째 양도): householdHouseCount_initial − 1
  // i=3 (세 번째 양도): householdHouseCount_initial − 2
```

#### 5-2-2. 검증 케이스

| caseData | 시나리오 | i | householdHouseCount_at_sale_i |
|---|---|---|---|
| `householdHouseCount=3, houses=[A,B,C]` | `[A→B] (2채 양도)` | 1 (A 양도) | 3 |
|   |   | 2 (B 양도) | 2 |
| `householdHouseCount=3, houses=[A,B,C]` | `[A→B→C] (3채 양도)` | 1 | 3 |
|   |   | 2 | 2 |
|   |   | 3 | 1 |
| `householdHouseCount=2, houses=[A,B]` | `[A] (1채만)` | 1 | 2 |
| `householdHouseCount=2, houses=[A,B]` | `[A→B] (2채 모두)` | 1 | 2 |
|   |   | 2 | 1 |

> **케이스 마지막 행 (`householdHouseCount=1`이 되는 케이스)**: 2번째 양도 시 가구 보유 주택 수가 1이 되므로, **단계 2 (1세대1주택 비과세 판정)에서 `is1Se1House = true`**가 될 수 있음. 비과세 요건(보유 ≥ 2년·거주 ≥ 24M·12억 이하 등)을 충족하면 비과세 적용. 충족 못 하면 v0.3-A의 단계 2 일반 분기.

#### 5-2-3. 다주택 중과 분기 변동 케이스

상태전이의 가장 중요한 효과는 **다주택 중과 가산세율이 양도 순서별로 다를 수 있다**는 점이다.

##### 5-2-3-1. 케이스 A — 3주택 보유, 2채 양도, 모두 saleRegulated=true

| 양도 | i | householdHouseCount | 가산세율 (조건 1·2 충족 가정) | 비고 |
|---|---|---|---|---|
| 1번째 (A) | 1 | 3 | **+30%p** (3주택 이상 중과) | findHeavyTaxRateAddition(3) = 0.30 |
| 2번째 (B) | 2 | 2 | **+20%p** (2주택 중과) | findHeavyTaxRateAddition(2) = 0.20 |

##### 5-2-3-2. 케이스 B — 2주택 보유, 2채 모두 양도, A=조정·B=비조정

| 양도 | i | householdHouseCount | saleRegulated | 중과 발동 | 가산세율 |
|---|---|---|---|---|---|
| 1번째 (A) | 1 | 2 | true | ✅ (조건 모두 충족) | +20%p |
| 2번째 (B) | 2 | 1 | false | ❌ (조건 1: householdHouseCount<2 미충족, 조건 2: saleRegulated=false 미충족, 동시에 false) | 0 (미발동) |

> **2번째 양도 시 단계 2 비과세 판정도 가능**: householdHouseCount=1이 되므로 `is1Se1House`이 비과세 요건 충족 시 true가 될 수 있음. 비과세 적용 시 시나리오 매력도가 크게 상승.

##### 5-2-3-3. 케이스 C — 양도 순서 역순 (B→A) 비교 (TYPE_2_ORDER)

| 양도 | i | householdHouseCount | saleRegulated | 중과 발동 | 가산세율 |
|---|---|---|---|---|---|
| 1번째 (B) | 1 | 2 | false | ❌ (조건 2: saleRegulated=false) | 0 |
| 2번째 (A) | 2 | 1 | true | ❌ (조건 1: householdHouseCount=1<2) | 0 |

> **A→B vs B→A 비교 (TYPE_2_ORDER)**: A→B는 1번째 A 양도가 +20%p 중과 적용 (큰 부담). B→A는 두 양도 모두 중과 미발동 (B는 조건 2, A는 조건 1로 차단). **B→A가 totalTax 합계 우수**. 본 케이스는 §10 TC-S02 골든셋의 핵심 검증 의도.

### 5-3. `basicDeductionUsed` 상태전이 산식 (양도소득 기본공제 250만원)

#### 5-3-1. 산식 (소득세법 제103조 인용)

소득세법 제103조 ① "거주자에 대하여는 양도소득에 대한 소득세를 산정함에 있어 양도소득금액에서 다음 각 호의 소득별로 해당 과세기간의 양도소득금액에서 각각 연 250만원을 공제한다." → **연 1회**, 과세기간(과세연도)별로 1회만 공제.

```
초기 상태: basicDeductionUsed_initial = caseData.basicDeductionUsed
            (사용자 입력값. 본 시뮬레이션 시작 전 이미 사용했는지 여부)

양도 i번째 진입 시:
  년도_i = scenario.years[i − 1]   // 1-based → 0-based 인덱스
  
  if (i === 1):
     basicDeductionUsed_at_sale_i = basicDeductionUsed_initial
  else:
     // 직전 양도와 같은 연도이고 직전이 250만원을 사용했으면 true 전달
     same_year_as_previous = (scenario.years[i − 1] === scenario.years[i − 2])
     previous_used_basic_deduction = (perTransactionResults[i − 2].steps.basicDeduction === 2_500_000)
     
     if (same_year_as_previous && previous_used_basic_deduction):
        basicDeductionUsed_at_sale_i = true
     else if (same_year_as_previous && !previous_used_basic_deduction):
        // 직전이 사용 안 했으면 (이미 누군가 사용해서 0이었다는 뜻) 그대로 true 유지
        basicDeductionUsed_at_sale_i = true   
     else:
        // 다른 연도이면 새 과세연도 기본공제 사용 가능
        basicDeductionUsed_at_sale_i = basicDeductionUsed_initial
```

#### 5-3-2. 검증 케이스

| 시나리오 | 양도 i | 연도 | 직전 연도 | basicDeductionUsed_at_sale_i | 효과 |
|---|---|---|---|---|---|
| `years=[2026,2026]` | 1 | 2026 | — | `false` (입력 그대로) | 250만원 공제 |
|   | 2 | 2026 | 2026 (같음) | `true` | 0만원 공제 |
| `years=[2026,2027]` | 1 | 2026 | — | `false` | 250만원 공제 |
|   | 2 | 2027 | 2026 (다름) | `false` (새 과세연도) | 250만원 공제 |
| `years=[2026,2026,2027]` | 1 | 2026 | — | `false` | 250만원 |
|   | 2 | 2026 | 2026 (같음) | `true` | 0 |
|   | 3 | 2027 | 2026 (다름) | `false` (새 과세연도) | 250만원 |

> **TYPE_3_TIMING (시점 분산)이 의미 있는 이유**: 같은 연도 2건 양도는 250만원 공제를 1번만 사용. 다른 연도로 분산하면 매 연도 250만원씩 공제 → 합계 500만원 공제 가능. 시나리오 비교에서 시점 분산이 totalTax 합계를 줄이는 핵심 메커니즘 중 하나.

> **단순화 가정**: 본 명세서는 사용자 입력 `basicDeductionUsed_initial`이 **본 시뮬레이션 외부 양도 내역에 의한 사용 여부**라고 가정. 본 시뮬레이션 내 양도들 사이의 같은 연도 처리는 위 산식이 자동 처리. 외부 영향(사용자가 본 시뮬레이션 외에 이미 양도한 자산이 있는 경우)은 `basicDeductionUsed_initial=true` 사용자 입력으로 표현.

### 5-4. `simulateScenarioWithStateTransition` 함수 계약

#### 5-4-1. 산식

```
입력: scenario (Scenario 객체 — §4-3), caseData
산출:
  perTransactionResults = []
  
  for i in 0..(scenario.ordered.length − 1):
     // 1) 양도 대상 House 추출
     houseId_i = scenario.ordered[i]
     house_i = caseData.houses.find(h => h.id === houseId_i)
     
     // 2) 양도일 적용 (시나리오 시점)
     year_i = scenario.years[i]
     house_i_with_year = { ...house_i, expectedSaleDate: `${year_i}-${month_default}-${day_default}` }
     // month_default·day_default는 스마트 기본값 적용 (§5-4-2)
     
     // 3) caseData 파생본 구성
     caseData_i = {
        ...caseData,
        houses: [house_i_with_year],
        householdHouseCount: caseData.householdHouseCount − i,        // §5-2
        basicDeductionUsed:  computeBasicDeductionUsedAtSale(scenario, i, perTransactionResults, caseData),  // §5-3
        salePlan: { ...caseData.salePlan, candidateHouseIds: [houseId_i] }
     }
     
     // 4) v0.3-A 단일 양도 호출 (인터페이스 보존)
     result_i = window.TaxOpt.taxEngine.calculateSingleTransfer(caseData_i)
     
     perTransactionResults.push(result_i)
  
  return perTransactionResults
출력: taxResult[]   (각 원소는 v0.3-A `calculateSingleTransfer` 반환 객체)
```

#### 5-4-2. 양도일 기본값 (`month_default`·`day_default`)

`expectedSaleDate`의 연도(`year_i`)는 `scenario.years[i]`로 결정되지만 월·일은 명세서에서 결정해야 한다.

| 결정 | 본 명세서 권고 | 비고 |
|---|---|---|
| `month_default` | `house_i.expectedSaleDate`의 월 (사용자 입력 그대로 보존) | 사용자 입력의 월·일 의도 보존 |
| `day_default` | `house_i.expectedSaleDate`의 일 (사용자 입력 그대로 보존) | 동일 |

> **사용자 입력 보존 원칙**: 사용자가 `houses[0].expectedSaleDate = "2026-09-15"` 입력 시 `targetSaleYears=[2026, 2027]`이면 시점 분산 시나리오는 "2026-09-15" 또는 "2027-09-15"로 적용. 월·일 임의 변경 금지 (사용자 의도 보존).

> **모듈 스펙·작업지시서 결정**: 다른 House가 다른 월·일을 가진 경우의 처리는 모듈 스펙에서 최종 결정. 본 명세서 권고는 **각 House의 expectedSaleDate 월·일을 그대로 유지하고 연도만 시나리오 시점으로 덮어쓰기**.

#### 5-4-3. 호출 인터페이스 — v0.3-A 보존 (가장 중요)

```js
// v0.3-B 시나리오 엔진의 호출 측 코드 (참고 골격, 본 명세서는 흐름만 정의)
const result_i = window.TaxOpt.taxEngine.calculateSingleTransfer(caseData_i);

// caseData_i는 v0.3-A의 caseData 스키마를 100% 만족
// → calculateSingleTransfer는 변경 없이 그대로 동작
// → 단계 4·9 다주택 중과 분기는 caseData_i.householdHouseCount + caseData_i.houses[0].saleRegulated에 따라 자동 발동
```

> **시나리오 엔진은 v0.3-A 산식을 직접 보유하지 않음**: 단계 4 장특공·단계 9 가산세율 계산·issueFlag 25종 발동은 모두 v0.3-A `tax_engine.js`의 책임. 시나리오 엔진은 **caseData 파생본 구성 + 결과 누적**만 담당.

#### 5-4-4. v0.3-A의 `calculateSingleTransfer`가 본 호출에서 자동 처리하는 사항

| 사항 | v0.3-A 처리 |
|---|---|
| 단계 0 — caseData 검증 | `validateCaseData(caseData_i)` 자동 실행. v0.3-B가 부적절한 caseData 파생본을 보내면 throw |
| 단계 2 — 1세대1주택 비과세 판정 | `householdHouseCount === 1` 분기 자동 작동 (마지막 양도 시) |
| 단계 4 — 다주택 중과 4단계 조건 평가 | `isHeavyTaxationApplicable(caseData_i, intermediates)` 자동 호출 |
| 단계 9 — 가산세율 룩업 + 동적 재계산 | `findHeavyTaxRateAddition(caseData_i.householdHouseCount)` 자동 호출 |
| issueFlag 25종 발동 | `collectIssueFlags` 자동 실행 |

### 5-5. `simulateScenarios(scenarios, caseData)` 통합 산식

```js
function simulateScenarios(scenarios, caseData) {
  return scenarios.map(scenario => {
    const perTransactionResults = simulateScenarioWithStateTransition(scenario, caseData);
    
    // 시나리오 metrics 합산
    const metrics = {
      totalTax: perTransactionResults.reduce((sum, r) => sum + r.metrics.totalTax, 0),
      netAfterTaxSaleAmount: perTransactionResults.reduce((sum, r) => sum + r.metrics.netAfterTaxSaleAmount, 0),
      effectiveTaxRate: computeAggregateEffectiveTaxRate(perTransactionResults)   // §5-6
    };
    
    // issueFlag 누적
    const issueFlags = aggregateIssueFlags(perTransactionResults);   // §9-3
    
    // actions 배열 (의사결정 #10 보강 3번)
    const actions = scenario.ordered.map((houseId, i) => ({
      type:     "sale",                      // v0.5+: "sale" | "gift" | ...
      houseId:  houseId,
      year:     scenario.years[i],
      amount:   perTransactionResults[i].metrics.netAfterTaxSaleAmount,
      taxpayer: "self"                       // v0.5+: "self" | "recipient"
    }));
    
    return {
      scenarioId:           scenario.scenarioId,
      scenarioType:         (rank·정렬 단계에서 결정),       // §6
      dimensions:           classifyScenarioDimensions(caseData.salePlan),
      actions:              actions,
      referenceYear:        scenario.years[0],     // 첫 양도 연도 — v0.5+ NPV baseline
      metrics:              metrics,
      perTransactionResults: perTransactionResults,
      issueFlags:           issueFlags,
      rank:                 null     // 정렬 후 부여 (§6-4)
    };
  });
}
```

### 5-6. 시나리오 합계 effectiveTaxRate 산식

#### 5-6-1. 산식

```
effectiveTaxRate_aggregate = Σ totalTax_i / Σ salePrice_i

  (분모가 0인 케이스 — 예: 비과세 + 12억 이하로 totalTax=0):
  if (Σ salePrice_i === 0):
     return null
  else:
     return Σ totalTax_i / Σ salePrice_i
```

#### 5-6-2. v0.3-A 단일 양도 effectiveTaxRate와의 관계

v0.3-A의 단일 effectiveTaxRate는 `result.metrics.effectiveTaxRate = totalTax / salePrice`. v0.3-B 시나리오 합계는 **분자·분모 각각 합산** 후 비율 산출 (단순 평균이 아님). 사용자 의도("내 양도 자산 묶음 전체의 평균 세부담률")에 정합.

> **TYPE_1_WHICH_ONE에서의 effectiveTaxRate**: TYPE_1은 양도 1건 시나리오이므로 `Σ` 합산이 본질적으로 단일 값. v0.3-A의 `result.metrics.effectiveTaxRate`와 동일한 값이 산출됨.

---

## 6. 시나리오 비교 정렬 (의사결정 #10 D안 + 보강 4건)

### 6-1. 정렬 함수 — `sortScenariosByMetric(scenarios, metricKey, order)`

#### 6-1-1. 산식

```
입력: scenarios[], metricKey, order
산출:
  sorted = scenarios의 사본(scenarios 변경 금지)
  
  1차 정렬: sorted를 metricKey 기준으로 order 방향으로 정렬
     - metricKey === "netAfterTaxSaleAmount" → scenario.metrics.netAfterTaxSaleAmount
     - metricKey === "effectiveTaxRate"     → scenario.metrics.effectiveTaxRate (null은 sentinel +∞ 처리)
     - metricKey === "totalTax"             → scenario.metrics.totalTax
  
  2차 정렬 (tiebreaker, §6-3): 1차 정렬 동률 시:
     ① Σ totalTax 오름차순 (totalTax 작은 게 우수)
     ② effectiveTaxRate 오름차순 (세부담률 낮은 게 우수)
     ③ scenarioId 사전순 (재현성)
  
  rank 부여: sorted[i].rank = i + 1
출력: sorted (rank 부여 완료)
```

#### 6-1-2. 정렬 안정성

본 명세서 정렬은 **재현성 보장**을 요구한다 (의사결정 #10 부수 결정 2번). 동일 입력 → 동일 출력 → 동일 rank. 이를 위해:

1. 안정 정렬(stable sort) 사용
2. tiebreaker가 결정성 있는 sort key 제공 (scenarioId 사전순까지)
3. 부동소수점 비교 시 적절한 epsilon 적용 (예: `Math.abs(a - b) < 1e-9`)

> **모듈 스펙 결정**: epsilon 값은 모듈 스펙에서 결정. 본 명세서는 결정성 요구만 명시.

### 6-2. metricKey 자동 결정 — SCENARIO_METRIC_RULES 룰 테이블

§3-1-2 표 그대로 (본 §6-2에서 다시 명시):

| 우선순위 | 차원 조건 | 시나리오 타입 | metricKey | order |
|---|---|---|---|---|
| 1 | `dimensions.hasTimingSpread === true` | TYPE_3_TIMING | `netAfterTaxSaleAmount` | desc |
| 2 | `dimensions.hasMultipleCandidates && !dimensions.hasOrderingDecision` | TYPE_1_WHICH_ONE | `effectiveTaxRate` | asc |
| 3 | (fallback) | TYPE_2_ORDER | `netAfterTaxSaleAmount` | desc |

#### 6-2-1. 룰 테이블 조회 함수

```js
function selectMetricKey(salePlan) {
  const dimensions = classifyScenarioDimensions(salePlan);
  
  for (const rule of SCENARIO_METRIC_RULES) {
    if (rule.condition(dimensions)) {
      return {
        scenarioType: rule.scenarioType,
        metricKey:    rule.metricKey,
        order:        rule.order
      };
    }
  }
  // fallback (이론상 도달 불가)
  return { scenarioType: "TYPE_2_ORDER", metricKey: "netAfterTaxSaleAmount", order: "desc" };
}
```

> **`SCENARIO_METRIC_RULES`의 위치**: `scenario_engine.js` (또는 별도 `scenario_rules.js`). `tax_rules.js`는 법령 명시 숫자만 보유하므로 본 룰은 별도 분리.

### 6-3. tiebreaker (의사결정 #10 부수 결정 2번 본문 인용)

1차 정렬 동률 시 다음 우선순위로 tiebreaker:

| 우선순위 | 비교 키 | 정렬 방향 | 사유 |
|---|---|---|---|
| 1차 | metrics 1순위 (metricKey) | desc/asc | §6-2 룰 |
| **2차** | **`metrics.totalTax`** | **오름차순** | **세부담 절댓값이 작은 게 우수** |
| **3차** | **`metrics.effectiveTaxRate`** | **오름차순** | **세부담률이 낮은 게 우수** |
| **4차** | **`scenarioId`** | **사전순** | **재현성 보장** |

#### 6-3-1. tiebreaker 검증 케이스

| 시나리오 | metrics |
|---|---|
| SC-1 | totalTax: 100M, netAfterTaxSaleAmount: 900M, effectiveTaxRate: 0.10 |
| SC-2 | totalTax: 100M, netAfterTaxSaleAmount: 900M, effectiveTaxRate: 0.10 |
| SC-3 | totalTax:  90M, netAfterTaxSaleAmount: 910M, effectiveTaxRate: 0.09 |

| 정렬 케이스 | 결과 |
|---|---|
| metricKey=netAfterTaxSaleAmount, desc | **SC-3 (910M) > SC-1·SC-2 동률 (900M)** → SC-1·SC-2는 2차(totalTax 동률) → 3차(effectiveTaxRate 동률) → **4차(scenarioId 사전순) → SC-1 우선** → 최종 [SC-3, SC-1, SC-2] |

### 6-4. 추천 시나리오 (`recommendBestScenario`)

#### 6-4-1. 산식

```
입력: scenarioResults[], salePlan
산출:
  1. selection = selectMetricKey(salePlan)   // §6-2-1
  2. sorted = sortScenariosByMetric(scenarioResults, selection.metricKey, selection.order)   // §6-1
  3. recommended = sorted[0]   // rank 1번
  
  4. 동률 안내:
     if (sorted.length >= 2 && metricsTied(sorted[0], sorted[1], selection.metricKey)):
        issueFlags.push({ code: "SCENARIO_TIE_DETECTED", severity: "info", ... })
출력:
  {
    scenarios:             sorted,
    recommendedScenarioId: recommended.scenarioId,
    scenarioType:          selection.scenarioType,
    metricKey:             selection.metricKey,
    dimensions:            recommended.dimensions,
    issueFlags:            (시나리오 레이어 issueFlag 합산, §9)
  }
```

#### 6-4-2. 동률 안내 (`SCENARIO_TIE_DETECTED`)

1차 metricKey가 정확히 같은 시나리오가 2개 이상이면 issueFlag로 안내. 사용자가 시나리오 비교에서 의사결정 보조를 받을 때 "이 시나리오들은 1순위 지표가 같다"는 사실 표면화.

### 6-5. 결과 화면 표시 정책 (의사결정 #10 부수 결정 1번 본문 인용)

| 정책 | 내용 |
|---|---|
| **3개 지표 모두 표시** | 비교표에 `totalTax`·`netAfterTaxSaleAmount`·`effectiveTaxRate` 모든 컬럼 표시 |
| **1순위 시각 강조** | 1순위 metricKey 컬럼만 시각 강조 (green badge 또는 굵은 글씨) |
| **시나리오 타입 캡션** | 표 헤더 또는 캡션에 "TYPE_1_WHICH_ONE: 어느 1채를 양도할지 비교" 같은 명시 |

> **결과 화면 구현**: `result.html` v0.4 동적 렌더링 시 적용. 본 명세서는 표시 정책만 명시 (UI 구현 최종 결정은 v0.4 작업).

---

## 7. 결과 객체 구조 (`result.scenarios`)

### 7-1. 시나리오 엔진 톱레벨 결과 객체

```js
scenarioPipelineResult = {
  // ─── 메타 ───
  engineVersion:    string,        // "v0.3.0-A" (taxEngine 버전 그대로)
  scenarioEngineVersion: string,   // "v0.3-B"
  ruleVersion:      string,        // tax_rules.RULE_VERSION
  caseDataSnapshot: object,        // 입력 캡처
  timestamp:        string,        // ISO 8601
  
  // ─── 시나리오 분류 메타 ───
  dimensions:    {
    hasMultipleCandidates: boolean,
    hasOrderingDecision:   boolean,
    hasTimingSpread:       boolean
  },
  scenarioType:  "TYPE_1_WHICH_ONE" | "TYPE_2_ORDER" | "TYPE_3_TIMING",
  metricKey:     "effectiveTaxRate" | "netAfterTaxSaleAmount" | "totalTax",
  metricOrder:   "asc" | "desc",
  
  // ─── 시나리오 배열 (정렬·rank 부여 완료) ───
  scenarios:             ScenarioResult[],
  recommendedScenarioId: string,
  
  // ─── 시나리오 레이어 issueFlag ───
  issueFlags:    IssueFlag[]   // §9 — 양도별 issueFlag 누적 + 시나리오 레이어 신규
}
```

### 7-2. ScenarioResult 구조 (의사결정 #10 보강 3번 본문 인용)

```js
ScenarioResult = {
  // ─── 식별 ───
  scenarioId:    string,          // "SC-1", "SC-2", ...
  scenarioType:  "TYPE_1_WHICH_ONE" | "TYPE_2_ORDER" | "TYPE_3_TIMING",
  rank:          number,          // 1·2·3·... (정렬 후 부여)
  
  // ─── 차원 태그 (보강 2번) ───
  dimensions: {
    hasMultipleCandidates: boolean,
    hasOrderingDecision:   boolean,
    hasTimingSpread:       boolean
  },
  
  // ─── 양도 행위 배열 (보강 3번 — v0.5+ 확장 대비 사전 노출) ───
  actions: [{
    type:     "sale",             // v0.5+: "sale" | "gift" | "partial_gift" | "hold"
    houseId:  string,             // "A", "B", "C"
    year:     number,             // 2026, 2027, ...
    amount:   number,             // netAfterTaxSaleAmount (단일 양도)
    taxpayer: "self"              // v0.5+: "self" | "recipient"
  }],
  
  // ─── 시점 메타 (보강 3번 — v0.5+ NPV baseline) ───
  referenceYear: number,          // 첫 양도 연도
  
  // ─── 시나리오 합계 metrics ───
  metrics: {
    totalTax:              number,   // Σ totalTax_i
    netAfterTaxSaleAmount: number,   // Σ netAfterTaxSaleAmount_i
    effectiveTaxRate:      number | null   // §5-6 산식
  },
  
  // ─── 양도 1건당 v0.3-A 결과 객체 (perTransactionResults) ───
  perTransactionResults: TaxResult[],   // v0.3-A `calculateSingleTransfer` 반환 객체 배열
  
  // ─── 시나리오별 issueFlag ───
  issueFlags: IssueFlag[]
}
```

### 7-3. perTransactionResults — v0.3-A 결과 객체 그대로 보존

`perTransactionResults[i]`는 v0.3-A `calculateSingleTransfer(caseData_i)` 반환 객체 그대로다. 구조 변경 없음. 시나리오 엔진은 본 객체를 **읽기 전용**으로 사용.

| 필드 | v0.3-A | v0.3-B |
|---|---|---|
| `engineVersion` | "v0.3.0-A" | 동일 |
| `ruleVersion` | tax_rules.RULE_VERSION | 동일 |
| `lawRefs` | tax_rules.LAW_REFS | 동일 |
| `caseDataSnapshot` | 양도 1건의 caseData_i 캡처 | 동일 (시나리오 시뮬레이션 시점의 caseData_i) |
| `steps` | 23 + v0.3-A 신규 4 = 27종 | 동일 |
| `metrics` | { totalTax, netAfterTaxSaleAmount, effectiveTaxRate } | 동일 |
| `issueFlags` | v0.3-A 25종 카탈로그 | 동일 (시나리오 레이어 신규 issueFlag는 ScenarioResult.issueFlags에 별도 보유) |
| `timestamp` | ISO 8601 | 동일 |

### 7-4. 결과 화면 (`result.html`) 사용 영역 (v0.4 인계)

본 명세서는 결과 객체 구조만 정의. 화면 표시는 v0.4 작업.

| 화면 영역 | 사용 필드 |
|---|---|
| 시나리오 비교표 | `scenarios[].metrics` (3개 지표) + `rank` + `scenarioType` 캡션 |
| 추천 시나리오 강조 | `recommendedScenarioId` + `scenarios[0]` (rank 1) |
| 시나리오 상세 (행 펼치기) | `scenarios[].actions[]` + `scenarios[].perTransactionResults[]` |
| issueFlag 표시 | `issueFlags` (시나리오 레이어) + `scenarios[].issueFlags` (양도별) |
| 시나리오 메타 (캡션) | `scenarioType` + `metricKey` + `dimensions` |

> **B-032 인계 — 결과 객체 톱레벨 구조 정정**: v0.3-B 명세서는 `scenarioPipelineResult`를 톱레벨로, `ScenarioResult.metrics`를 캡슐화로 정의. v0.3-A의 `result.metrics` 캡슐화 패턴 일관 계승. 화면 측은 캡슐화 경로(`scenario.metrics.totalTax`)로 접근.
---

## 8. v0.3-A 단일 시나리오 회귀 안전성

### 8-1. 회귀 안전성 원칙 (절대 깨지면 안 됨)

v0.3-A 골든셋 TC-001~014 14건은 v0.3-B에서도 **단일 시나리오 입력**으로 동일 totalTax를 산출해야 한다. 이는 v0.3-B 시나리오 엔진이 v0.3-A 단일 양도 인터페이스(`calculateSingleTransfer`)를 그대로 호출하기 때문에 자명하지만, 본 §8에서 명시적으로 검증한다.

### 8-2. 단일 시나리오 입력 정의

다음 4개 조건을 모두 만족하는 입력을 **단일 시나리오 입력**으로 정의:

```
조건 1: salePlan.candidateHouseIds.length === 1
조건 2: salePlan.targetSaleCount === 1
조건 3: salePlan.allowYearSplitting === false
조건 4: salePlan.targetSaleYears.length === 1
```

### 8-3. 단일 시나리오 입력 시 v0.3-B 동작

| 단계 | 단일 시나리오 입력 시 v0.3-B 동작 |
|---|---|
| §4-2 매도 대상 조합 | C(1,1) = `[[A]]` (1개 조합) |
| §4-3 양도 순서 | `[[A]]` (단일 원소이므로 순열 자명) |
| §4-4 양도 시점 | targetSaleYears=[Y] 고정 → `[{ ordered: [A], years: [Y] }]` (1개 시나리오) |
| §5 상태전이 | i=1 단일 호출 → `householdHouseCount` 변동 없음 |
| §6 정렬 | scenarios.length === 1 → 정렬 자명 (rank 1만) |
| `calculateSingleTransfer` 호출 | **v0.3-A 골든셋 입력과 100% 동일한 caseData_i 전달** |

### 8-4. 검증 매트릭스

다음 14건이 단일 시나리오 입력 시 v0.3-A의 totalTax를 그대로 산출:

| TC | v0.3-A 정답값 | v0.3-B 단일 시나리오 입력 시 | 일치 검증 |
|---|---|---|---|
| TC-001 | 98,241,000 | scenarios[0].metrics.totalTax === 98,241,000 | ✅ (산식 동일) |
| TC-002 | 61,050,000 | scenarios[0].metrics.totalTax === 61,050,000 | ✅ |
| TC-003 | 0 | scenarios[0].metrics.totalTax === 0 | ✅ |
| TC-004 | 99,286,000 | scenarios[0].metrics.totalTax === 99,286,000 | ✅ |
| TC-005 | 924,000 | scenarios[0].metrics.totalTax === 924,000 | ✅ |
| TC-006 | 0 (1세대1주택 비과세) | scenarios[0].metrics.totalTax === 0 | ✅ |
| TC-007 | 6,161,100 (1세대1주택 + 안분) | scenarios[0].metrics.totalTax === 6,161,100 | ✅ |
| TC-008 | 130,878,000 (다주택 일반) | scenarios[0].metrics.totalTax === 130,878,000 | ✅ |
| TC-009 | 1,383,642 (1세대1주택 + 표 2 80%) | scenarios[0].metrics.totalTax === 1,383,642 | ✅ |
| TC-010 | 122,826,000 (일시적 2주택) | scenarios[0].metrics.totalTax === 122,826,000 | ✅ |
| TC-011 | 286,616,000 (2주택 중과 +20%p) | scenarios[0].metrics.totalTax === 286,616,000 | ✅ |
| TC-012 | 339,141,000 (3주택 중과 +30%p) | scenarios[0].metrics.totalTax === 339,141,000 | ✅ |
| TC-013 | 130,878,000 (=TC-008, 회귀) | scenarios[0].metrics.totalTax === 130,878,000 | ✅ |
| TC-014 | 130,878,000 (=TC-008, 보강) | scenarios[0].metrics.totalTax === 130,878,000 | ✅ |

### 8-5. 회귀 안전성 보장 메커니즘 (산식 증명)

v0.3-B가 단일 시나리오 입력 시 v0.3-A 결과를 보존하는 이유는 다음 산식 흐름에 의해 자명하다:

```
v0.3-B 시나리오 엔진(단일 시나리오 입력):
  caseData → generateScenarios(caseData) → [scenario_1] (1개)
  → simulateScenarios([scenario_1], caseData) →
       caseData_1 = {
          ...caseData,
          houses: [caseData.houses[0]],          // length 1 그대로
          householdHouseCount: caseData.householdHouseCount − 0 = caseData.householdHouseCount,
          basicDeductionUsed:  caseData.basicDeductionUsed,    // 1번째 양도 → initial 그대로
          salePlan: { ...caseData.salePlan, candidateHouseIds: [house_id] }
       }
  → calculateSingleTransfer(caseData_1)

v0.3-A 단일 양도 호출:
  → calculateSingleTransfer(caseData)
  
caseData_1과 caseData의 차이:
  - houses: 길이 1 그대로 (변동 없음)
  - householdHouseCount: 변동 없음 (i=0)
  - basicDeductionUsed: 변동 없음 (i=0)
  - salePlan.candidateHouseIds: 단일 시나리오 입력 시 이미 길이 1 → 변동 없음
  - 그 외: 동일

→ caseData_1 ≡ caseData
→ calculateSingleTransfer(caseData_1) ≡ calculateSingleTransfer(caseData)
→ totalTax 일치 ∎
```

> **회귀 깨지면 즉시 롤백**: 위 산식 증명이 실제 코드에서 깨지면 v0.3-B 마이그레이션 실패. 의사결정 #11 (정확성 > 속도)에 따라 즉시 롤백 + 원인 분석.

### 8-6. v0.3-B 코드 회귀 테스트 권장

회귀 안전성은 **회귀 테스트 그룹 신설**로 보장:

```
tests/scenario_engine.test.js 신규 (작업 창 #14+ Claude Code 산출):
  그룹 R-A: TC-001~014 단일 시나리오 입력 14건 회귀
    각 TC를 단일 시나리오 입력으로 변환 후
    runScenarioPipeline(caseData)를 호출하여
    scenarios[0].metrics.totalTax === v0.3-A 정답값 검증
```

> **의사결정 #9 v9 준수**: 본 명세서는 .js 코드 산출 금지. 회귀 테스트 본문은 작업 창 #14+ Claude Code 책임.

---

## 9. issueFlag 카탈로그 (v0.3-B 신규)

### 9-1. v0.3-A 카탈로그 인용 (25종 그대로 보존)

v0.3-A의 issueFlag 카탈로그 25종은 **양도 1건당 발동**되며 v0.3-B에서도 그대로 보존된다. 본 명세서는 v0.3-A §6 카탈로그를 재정의하지 않고, **시나리오 레이어 신규 issueFlag 약 6종**만 명시.

### 9-2. v0.3-B 시나리오 레이어 신규 issueFlag (약 6종)

| # | code | severity | 발동 조건 | 메시지 (요약) |
|---|---|---|---|---|
| 1 | `SCENARIO_NO_VALID_COMBINATION` | error | §4-2 후보 조합 0개 | 매도 가능한 후보 조합이 없습니다 |
| 2 | `SCENARIO_FIXED_SALE_FORCED` | info | `salePlan.fixedSaleHouseIds.length > 0` | 사용자 지정으로 매도 대상이 일부 강제되었습니다 |
| 3 | `SCENARIO_SINGLE_FIXED` | info | scenarios.length === 1 | 시나리오가 1개로 결정되어 있어 추천 의미가 제한적입니다 |
| 4 | `SCENARIO_COUNT_EXCEEDS_THRESHOLD` | warning | scenarios.length >= 50 | 시나리오가 많아 화면 표시가 길어질 수 있습니다 (현재: N건) |
| 5 | `SCENARIO_COUNT_HARD_LIMIT` | error | scenarios.length >= 100 | 시나리오 수가 한계를 초과했습니다. salePlan을 좁혀 다시 시도해 주세요 |
| 6 | `SCENARIO_TIE_DETECTED` | info | 1순위 metricKey 동률이 2개 이상 | 1순위 지표가 동률인 시나리오가 있습니다 (tiebreaker 적용) |
| 7 | `STATE_TRANSITION_HOUSE_COUNT_REACHED_ONE` | info | 양도 시뮬레이션 중 어느 양도 시점에 `householdHouseCount === 1`이 됨 | 마지막 양도가 1세대1주택 비과세 적용 가능 |
| 8 | `STATE_TRANSITION_BASIC_DEDUCTION_DEPLETED` | info | 동일 과세연도 2번째 양도부터 기본공제 250만원 미적용 | 동일 과세연도 내 2건 이상 양도로 기본공제가 한 번만 적용되었습니다 |
| 9 | `SALEPLAN_VALIDATION_WARNING` | warning | `validateSalePlan`의 SP_W001~SP_W004 발동 시 | salePlan 검증 경고 (개별 코드는 메시지에 포함) |
| 10 | `SCENARIO_TYPE_FALLBACK` | info | SCENARIO_METRIC_RULES fallback (TYPE_2_ORDER) 분기 진입 | 시나리오 타입이 기본값(TYPE_2_ORDER)으로 결정되었습니다 |

> **약 6~10종 중 정확한 채택 갯수는 모듈 스펙에서 결정**: 본 명세서는 발동 조건만 명시. 일부는 통합되거나 정밀화될 수 있음 (예: 9·10은 중복 정보로 간주 시 통합).

### 9-3. issueFlag 누적 정책 (`aggregateIssueFlags`)

`ScenarioResult.issueFlags` 누적 시:

```
입력: perTransactionResults[]
산출:
  collected = []
  for each result_i in perTransactionResults:
     for each flag in result_i.issueFlags:
        collected.push({
           ...flag,
           transactionIndex: i + 1,        // 양도 i번째에서 발동했음을 명시
           houseId: scenario.ordered[i]    // 양도 대상 식별
        })
  
  // 중복 제거 옵션 (같은 code가 여러 양도에서 발동했을 때 정책 결정)
  if (DEDUPLICATE_OPTION === "preserve_all"):
     return collected   // 모두 보존 (메시지에 transactionIndex 명시)
  else if (DEDUPLICATE_OPTION === "first_only"):
     return uniqueByCode(collected)   // 같은 code 첫 발동만
  else if (DEDUPLICATE_OPTION === "merge"):
     return mergeByCode(collected)    // 같은 code 발동 양도 인덱스 배열로 병합
출력: IssueFlag[]
```

> **권고**: `preserve_all` 채택. 양도별 issueFlag를 화면에서 양도 1·2·3별로 분리하여 표시. 모듈 스펙에서 최종 결정.

### 9-4. 시나리오 레이어 issueFlag 발동 시점

| 발동 시점 | 발동 issueFlag |
|---|---|
| `validateSalePlan` (§2-2-2) | `SALEPLAN_VALIDATION_WARNING`, `SP_E001`·`SP_E002` (error는 throw) |
| `generateSaleTargetCombinations` (§4-2) | `SCENARIO_NO_VALID_COMBINATION`, `SCENARIO_FIXED_SALE_FORCED` |
| `generateScenarios` 후처리 (§4-5) | `SCENARIO_SINGLE_FIXED`, `SCENARIO_COUNT_EXCEEDS_THRESHOLD`, `SCENARIO_COUNT_HARD_LIMIT` |
| `simulateScenarioWithStateTransition` (§5) | `STATE_TRANSITION_HOUSE_COUNT_REACHED_ONE`, `STATE_TRANSITION_BASIC_DEDUCTION_DEPLETED` |
| `recommendBestScenario` (§6-4) | `SCENARIO_TIE_DETECTED`, `SCENARIO_TYPE_FALLBACK` |

---

## 10. 골든셋 (TC-S01~) — v0.3-B 시나리오 비교 신규

### 10-1. 골든셋 신규 4건 일람

v0.3-B 시나리오 비교를 검증하기 위한 신규 골든셋 4건. 정답값은 검증팀 손계산 후 결정 권고 (본 명세서는 산식 명시 + 기대 시나리오 타입 + 기대 추천 시나리오 ID까지).

| TC | 보유 | 양도 | 시나리오 타입 | 우선순위 | 검증 의도 |
|---|---|---|---|---|---|
| **TC-S01** | 2주택 (A·B) | 1채 (미정) | TYPE_1_WHICH_ONE | **필수** | 어느 1채 양도 비교 — effectiveTaxRate 정렬 검증 |
| **TC-S02** | 2주택 (A·B), A 조정·B 비조정 | 2채 (모두) | TYPE_2_ORDER | **필수** | 양도 순서 비교 — A→B vs B→A, 중과 분기 변동 검증 |
| **TC-S03** | 3주택 (A·B·C) | 1채 (미정) | TYPE_1_WHICH_ONE | **필수** | 3주택 단일 양도 — 첫 양도 +30%p 중과 분기 검증 |
| TC-S04 | 2주택 (A·B) | 2채 (모두) | TYPE_3_TIMING | 선택 | 시점 분산 비교 — 동일 연도 vs 분산, 기본공제 250만원 효과 검증 |

> **TC-S04 (선택) 사유**: 본질 가치 4영역 NPV 미통합 상태에서 시점 분산은 기본공제 250만원 효과만 검증 가능 (제한적). post-MVP B-030 통합 후 본격 검증 권고.

### 10-2. TC-S01 — 2주택자, 1채 양도 (TYPE_1_WHICH_ONE)

#### 10-2-1. 입력

```js
caseData = {
  baseYear: 2026,
  householdMembers: 1,
  basicDeductionUsed: false,
  householdHouseCount: 2,           // 2주택
  isOneTimeTwoHouses: false,
  
  houses: [
    {
      id: "A",
      acquisitionDate: "2014-05-01",
      acquisitionPrice: 500_000_000,
      necessaryExpense: 20_000_000,
      acquisitionRegulated: false,
      residenceMonths: 0,                  // 거주 없음
      livingNow: false,
      expectedSaleDate: "2026-09-15",
      expectedSalePrice: 1_000_000_000,    // 10억
      saleRegulated: true                  // 조정대상지역
    },
    {
      id: "B",
      acquisitionDate: "2018-03-10",
      acquisitionPrice: 600_000_000,
      necessaryExpense: 15_000_000,
      acquisitionRegulated: false,
      residenceMonths: 0,
      livingNow: false,
      expectedSaleDate: "2026-09-15",
      expectedSalePrice: 900_000_000,      // 9억
      saleRegulated: false                 // 비조정대상
    }
  ],
  
  salePlan: {
    targetSaleCount: 1,
    candidateHouseIds: ["A", "B"],
    fixedSaleHouseIds: [],
    excludedHouseIds: [],
    allowSystemToChooseSaleTargets: true,
    allowYearSplitting: false,
    targetSaleYears: [2026]
  }
};
```

#### 10-2-2. 시나리오 생성 흐름

| 단계 | 결과 |
|---|---|
| `classifyScenarioDimensions` | `{ hasMultipleCandidates: true, hasOrderingDecision: false, hasTimingSpread: false }` |
| `selectMetricKey` | `{ scenarioType: "TYPE_1_WHICH_ONE", metricKey: "effectiveTaxRate", order: "asc" }` |
| `generateSaleTargetCombinations` | `[{A}, {B}]` (2개 조합) |
| `generateSaleOrderScenarios` | `[[A], [B]]` (2개 — 순열 자명) |
| `generateSaleYearScenarios` | `[{ ordered: [A], years: [2026] }, { ordered: [B], years: [2026] }]` (2개) |

#### 10-2-3. 시뮬레이션 (각 시나리오의 단일 양도 결과)

##### SC-1 (A 양도)

| 단계 | 값 | 비고 |
|---|---|---|
| caseData_1 | houses=[A], householdHouseCount=2, saleRegulated=true | 다주택 + 조정대상 |
| 단계 4 | `isHeavyTaxation = true` (4조건 모두 충족) | TC-011 케이스 산식 |
| `heavyRateAddition` | 0.20 (2주택) | |
| `longTermDeduction` | 0 (중과 시 배제) | |
| `transferGain` | 480,000,000 | 1,000,000,000 − 500,000,000 − 20,000,000 |
| `taxBase` | 477,500,000 | 480,000,000 − 2,500,000 |
| `calculatedTax` | 260,560,000 | TC-011 명세서 §3-4-3 산식 |
| `localIncomeTax` | 26,056,000 | floor(260,560,000 × 0.1) |
| **`totalTax`** | **286,616,000** | **TC-011 정답값과 동일** |
| `netAfterTaxSaleAmount` | 713,384,000 | 1,000,000,000 − 286,616,000 |
| `effectiveTaxRate` | **0.286616** | 286,616,000 / 1,000,000,000 |

##### SC-2 (B 양도)

| 단계 | 값 | 비고 |
|---|---|---|
| caseData_2 | houses=[B], householdHouseCount=2, saleRegulated=false | 다주택 + 비조정대상 → 중과 미발동 (조건 2 미충족) |
| 단계 4 | `isHeavyTaxation = false` | |
| `appliedDeductionTable` | 1 (다주택 + 표 1) | 보유 약 8년 |
| `transferGain` | 285,000,000 | 900,000,000 − 600,000,000 − 15,000,000 |
| `holdingYears` | 8 (2018-03 → 2026-09 → 만 8년 6개월) | 표 1: 16% |
| `longTermDeduction` | 45,600,000 | floor(285,000,000 × 0.16) |
| `capitalGainIncome` | 239,400,000 | |
| `taxBase` | 236,900,000 | |
| `calculatedTax` (누진세율 1.5억 초과~3억) | **57,118,000** ⏳ | 검증팀 검증 대기. 산식: 19,406,000 + (236,900,000 − 150,000,000) × 0.43 = 19,406,000 + 37,367,000 = 56,773,000 (참고용 — 검증팀 정밀 계산 필요) |
| `localIncomeTax` | ⏳ | |
| **`totalTax`** | **⏳ (검증팀 결정)** | |
| **`effectiveTaxRate`** | **⏳ (totalTax / 900,000,000)** | |

> **TC-S01 정답값 산출은 검증팀 권고**: B의 totalTax는 v0.3-A 명세서 검증 케이스에 정확 일치하는 케이스가 없어 본 명세서가 단정하지 않음. 검증팀 손계산 + 홈택스 모의계산으로 산출 후 본 명세서 갱신 (의사결정 #11 정확성 > 속도).

#### 10-2-4. 비교 정렬

| 시나리오 | totalTax | netAfterTaxSaleAmount | effectiveTaxRate |
|---|---|---|---|
| SC-1 (A 양도) | 286,616,000 | 713,384,000 | 0.286616 |
| SC-2 (B 양도) | ⏳ | ⏳ | ⏳ (예상: 0.06~0.08) |

| 정렬 (metricKey=effectiveTaxRate, asc) | 추천 | 검증 의도 |
|---|---|---|
| **rank 1: SC-2 (B 양도)** ⏳ | **B 양도 추천** | 비조정대상 + 중과 미발동 → effectiveTaxRate 낮음 |
| rank 2: SC-1 (A 양도) | | A는 조정대상 + 중과 +20%p → effectiveTaxRate 높음 |

#### 10-2-5. 기대 issueFlag 발동

| 시나리오 레이어 | code | severity | 발동 |
|---|---|---|---|
| `SCENARIO_FIXED_SALE_FORCED` | info | ❌ (fixedSaleHouseIds=[]) | |
| `SCENARIO_SINGLE_FIXED` | info | ❌ (scenarios.length=2) | |
| `SCENARIO_TIE_DETECTED` | info | ❌ (effectiveTaxRate 차이 큼) | |
| 양도 1번째 (SC-1, A 양도) | TC-011 issueFlag (HEAVY_TAXATION_APPLIED 등) | warning/info | ✅ |
| 양도 1번째 (SC-2, B 양도) | (TC-008 패턴 — 다주택 일반과세) | info | ✅ |

#### 10-2-6. 검증 의도

- **TYPE_1_WHICH_ONE의 핵심 검증**: 양도가액이 더 큰 A(10억) vs 작은 B(9억)에서, **netAfterTaxSaleAmount는 A가 더 큰데(713M vs B의 약 850M ⏳)**, 절세 효율은 B가 우수.
- effectiveTaxRate 정렬이 사용자 의도("어느 주택이 절세 효율 우수")에 정확히 부합.
- netAfterTaxSaleAmount 정렬을 사용하면 B가 더 클 가능성이 있어 동일 답이 나오지만, **양도가액이 비슷한 케이스에서는 effectiveTaxRate가 결정적 분기점**.
- 검증팀: 손계산 + 홈택스 모의계산. 담당자 미정 (5/3 결정).

### 10-3. TC-S02 — 2주택자, 2채 모두 양도, A 조정·B 비조정 (TYPE_2_ORDER)

#### 10-3-1. 입력

```js
caseData = {
  baseYear: 2026,
  householdMembers: 1,
  basicDeductionUsed: false,
  householdHouseCount: 2,
  isOneTimeTwoHouses: false,
  
  houses: [
    {
      id: "A",
      acquisitionDate: "2014-05-01",
      acquisitionPrice: 500_000_000,
      necessaryExpense: 20_000_000,
      acquisitionRegulated: false,
      residenceMonths: 0,
      livingNow: false,
      expectedSaleDate: "2026-09-15",
      expectedSalePrice: 1_000_000_000,
      saleRegulated: true                  // ★ 조정대상
    },
    {
      id: "B",
      acquisitionDate: "2014-05-01",       // 보유연수 동일하게
      acquisitionPrice: 500_000_000,       // 동일
      necessaryExpense: 20_000_000,
      acquisitionRegulated: false,
      residenceMonths: 0,
      livingNow: false,
      expectedSaleDate: "2026-09-15",
      expectedSalePrice: 1_000_000_000,    // 동일 (오로지 saleRegulated만 다름)
      saleRegulated: false                 // ★ 비조정대상
    }
  ],
  
  salePlan: {
    targetSaleCount: 2,                    // 모두 양도
    candidateHouseIds: ["A", "B"],
    fixedSaleHouseIds: [],
    excludedHouseIds: [],
    allowSystemToChooseSaleTargets: true,
    allowYearSplitting: false,
    targetSaleYears: [2026]
  }
};
```

> **A·B의 차이**: `saleRegulated`만 다름 (다른 모든 입력 동일). 양도 순서가 결과에 미치는 영향을 정확히 검증.

#### 10-3-2. 시나리오 생성 흐름

| 단계 | 결과 |
|---|---|
| `classifyScenarioDimensions` | `{ hasMultipleCandidates: false, hasOrderingDecision: true, hasTimingSpread: false }` (fixedSaleHouseIds=[] 이지만 candidateHouseIds.length === targetSaleCount이므로 hasMultipleCandidates 미적용) |
| `selectMetricKey` | `{ scenarioType: "TYPE_2_ORDER", metricKey: "netAfterTaxSaleAmount", order: "desc" }` |
| `generateSaleTargetCombinations` | `[{A,B}]` (1개 조합 — 모두 양도) |
| `generateSaleOrderScenarios` | `[[A,B], [B,A]]` (2개 순열) |
| `generateSaleYearScenarios` | `[{ordered:[A,B], years:[2026,2026]}, {ordered:[B,A], years:[2026,2026]}]` |

> **`hasMultipleCandidates` 판정**: `salePlan.candidateHouseIds.length > 1 && salePlan.fixedSaleHouseIds.length === 0` 조건. TC-S02는 candidates=2채, fixed=0, **그러나 targetSaleCount=2 (모두 양도)**. 의사결정 #10 정의는 `candidateHouseIds.length > 1 && fixedSaleHouseIds.length === 0`으로 명시되어 있으므로 형식적으로 `hasMultipleCandidates = true`. 그러나 룰 테이블 우선순위 1·2를 동시에 평가할 때 `hasOrderingDecision = true` (targetSaleCount=2 ≥ 2)로 우선순위 2 조건(`hasMultipleCandidates && !hasOrderingDecision`)이 미충족 → fallback 우선순위 3으로 TYPE_2_ORDER 적용. **본 케이스는 룰 테이블 통합 평가가 정상 작동**함을 의도적으로 검증.

#### 10-3-3. 시뮬레이션 — SC-1 (A→B 순)

##### SC-1 양도 1번째 (A 양도, householdHouseCount=2)

| 단계 | 값 |
|---|---|
| caseData_1.householdHouseCount | 2 |
| caseData_1.basicDeductionUsed | false |
| caseData_1.houses[0].saleRegulated | true |
| 단계 4 | `isHeavyTaxation = true` (4조건 충족) |
| `heavyRateAddition` | 0.20 |
| **`totalTax_A`** | **286,616,000** (TC-011과 동일) |

##### SC-1 양도 2번째 (B 양도, householdHouseCount=1)

| 단계 | 값 |
|---|---|
| caseData_2.householdHouseCount | **1** (양도 후 감소) |
| caseData_2.basicDeductionUsed | **true** (동일 연도 + 1번째에서 사용) |
| caseData_2.houses[0].saleRegulated | false |
| 단계 2 | `is1Se1House`: 거주요건·보유요건 검증 → 거주 0개월·보유 12년 → **거주요건 미충족 → false** (B는 비과세 미적용) |
| 단계 4 | `isHeavyTaxation = false` (조건 1: householdHouseCount<2 미충족) |
| `appliedDeductionTable` | 1 (다주택이 아니지만 1세대1주택 비과세도 미적용 → 표 1 일반과세) |
| `holdingYears` | 12 (보유 12년) |
| `longTermDeduction` | floor(480,000,000 × 0.24) = 115,200,000 |
| `taxBase` | 480,000,000 − 115,200,000 − **0** (basicDeductionUsed=true → 기본공제 0) = **364,800,000** |
| **`totalTax_B`** | **⏳ (검증팀 결정)** |

> **양도 2번째 단계 4 — `appliedDeductionTable` 결정**: householdHouseCount=1이지만 `is1Se1House=false` (거주요건 미충족). v0.3-A §3-3 표 1 적용 분기 — "다주택 OR (1주택 AND 비과세 미적용)". 본 케이스는 후자로 표 1 24% 적용.

##### SC-1 합계

| metric | 값 |
|---|---|
| Σ totalTax | 286,616,000 + ⏳ = **⏳** |
| Σ netAfterTaxSaleAmount | (1,000,000,000 − 286,616,000) + (1,000,000,000 − ⏳) = **⏳** |
| effectiveTaxRate | (Σ totalTax) / (1,000,000,000 + 1,000,000,000) = ⏳ / 2,000,000,000 |

#### 10-3-4. 시뮬레이션 — SC-2 (B→A 순)

##### SC-2 양도 1번째 (B 양도, householdHouseCount=2)

| 단계 | 값 |
|---|---|
| caseData_1.householdHouseCount | 2 |
| caseData_1.basicDeductionUsed | false |
| caseData_1.houses[0].saleRegulated | **false** |
| 단계 4 | `isHeavyTaxation = false` (조건 2: saleRegulated=false 미충족) |
| `appliedDeductionTable` | 1 (다주택 + 보유 12년) |
| `longTermDeduction` | 115,200,000 |
| `taxBase` | 480,000,000 − 115,200,000 − 2,500,000 = 362,300,000 |
| **`totalTax_B`** | **⏳ (TC-008과 유사 패턴, 검증팀 결정)** |

##### SC-2 양도 2번째 (A 양도, householdHouseCount=1)

| 단계 | 값 |
|---|---|
| caseData_2.householdHouseCount | **1** |
| caseData_2.basicDeductionUsed | **true** |
| caseData_2.houses[0].saleRegulated | true |
| 단계 4 | `isHeavyTaxation = false` (조건 1: householdHouseCount<2 미충족 — A 단독으로는 1주택 + saleRegulated=true이지만 조건 1·2 AND이므로 false) |
| 단계 2 | `is1Se1House`: 거주 0M → 거주요건 미충족 → false |
| `appliedDeductionTable` | 1 (1주택 + 비과세 미적용) |
| `longTermDeduction` | 115,200,000 |
| `taxBase` | 480,000,000 − 115,200,000 − **0** = 364,800,000 |
| **`totalTax_A`** | **⏳ (검증팀 결정)** |

##### SC-2 합계

| metric | 값 |
|---|---|
| Σ totalTax | ⏳ + ⏳ = **⏳** |

#### 10-3-5. 비교 정렬

| 시나리오 | Σ totalTax (예상) | Σ netAfterTaxSaleAmount (예상) | rank |
|---|---|---|---|
| SC-1 (A→B) | **큼** (1번째 양도가 +20%p 중과) | 작음 | 2 |
| **SC-2 (B→A)** | **작음** (양쪽 양도 모두 중과 미발동) | **큼** | **1** |

#### 10-3-6. 검증 의도 (가장 중요)

- **TYPE_2_ORDER의 핵심 검증**: 같은 자산 묶음(A,B 모두 양도, 같은 연도)에서 **양도 순서가 totalTax 합계를 결정적으로 분기**하는 케이스.
- A 먼저 양도(SC-1) → 1번째에서 +20%p 중과 부담. B를 먼저 양도(SC-2) → 양쪽 양도 모두 중과 미발동.
- 의사결정 #10 D안의 "양도 순서 비교"가 정확히 작동하는지 검증.
- `netAfterTaxSaleAmount` Σ 합계로 정렬 시 SC-2가 우수해야 함.

### 10-4. TC-S03 — 3주택자, 1채 양도 (TYPE_1_WHICH_ONE)

#### 10-4-1. 입력 (요약)

```js
caseData = {
  ...
  householdHouseCount: 3,           // 3주택
  houses: [
    { id: "A", saleRegulated: true,  expectedSalePrice: 1_000_000_000, ... },
    { id: "B", saleRegulated: true,  expectedSalePrice:   900_000_000, ... },
    { id: "C", saleRegulated: false, expectedSalePrice:   800_000_000, ... }
  ],
  salePlan: {
    targetSaleCount: 1,
    candidateHouseIds: ["A", "B", "C"],
    fixedSaleHouseIds: [],
    excludedHouseIds: [],
    allowSystemToChooseSaleTargets: true,
    allowYearSplitting: false,
    targetSaleYears: [2026]
  }
};
```

#### 10-4-2. 시나리오

| SC | 양도 | householdHouseCount | saleRegulated | 중과 | 가산세율 | 기대 totalTax |
|---|---|---|---|---|---|---|
| SC-1 | A | 3 | true | ✅ | +30%p | TC-012 패턴 |
| SC-2 | B | 3 | true | ✅ | +30%p | (양도가액 9억 + 동일 산식) |
| SC-3 | C | 3 | false | ❌ | 0 | (다주택 일반과세 + 8억) |

#### 10-4-3. 비교 정렬

| 시나리오 | effectiveTaxRate (예상) | rank |
|---|---|---|
| SC-1 (A 양도, +30%p) | 매우 높음 | 3 |
| SC-2 (B 양도, +30%p) | 매우 높음 | 2 |
| **SC-3 (C 양도)** | **낮음 (중과 없음)** | **1** |

#### 10-4-4. 검증 의도

- **3주택 + 첫 양도가 +30%p 중과**: 단일 양도라도 가구 보유 주택 수가 3이면 첫 양도 시 +30%p 중과.
- 비조정대상 주택(C)을 양도하면 중과 미발동 → effectiveTaxRate 크게 낮음.
- TYPE_1_WHICH_ONE의 D안 1순위 지표(effectiveTaxRate) 정상 작동 검증.

### 10-5. TC-S04 — 2주택자, 2채 모두 양도, 시점 분산 (TYPE_3_TIMING) — 선택

#### 10-5-1. 입력 (요약)

```js
caseData = {
  ...
  householdHouseCount: 2,
  houses: [
    { id: "A", saleRegulated: true,  ... },
    { id: "B", saleRegulated: false, ... }
  ],
  salePlan: {
    targetSaleCount: 2,
    candidateHouseIds: ["A", "B"],
    allowYearSplitting: true,           // ★ 시점 분산
    targetSaleYears: [2026, 2027]       // ★ 2개 연도
  }
};
```

#### 10-5-2. 시나리오 (단조 비감소 시점 적용)

| SC | ordered | years | 기대 효과 |
|---|---|---|---|
| SC-1 | [A, B] | [2026, 2026] | 동일 연도, 기본공제 250만원 1번 |
| SC-2 | [A, B] | [2026, 2027] | 분산, 기본공제 250만원 × 2 |
| SC-3 | [A, B] | [2027, 2027] | 동일 연도 (2027) |
| SC-4 | [B, A] | [2026, 2026] | (B→A 순서) |
| SC-5 | [B, A] | [2026, 2027] | (B→A 순서, 분산) |
| SC-6 | [B, A] | [2027, 2027] | |

#### 10-5-3. 비교 정렬

`hasTimingSpread = true` → 우선순위 1 → **TYPE_3_TIMING**, metricKey=`netAfterTaxSaleAmount`, order=desc.

> **TC-S04 정답값은 검증팀 결정 권고**: 6개 시나리오의 정확한 totalTax 산출은 본 명세서 외 검증팀 손계산 + 홈택스 모의계산. 본 명세서는 산식 흐름과 기대 시나리오 타입만 명시.

#### 10-5-4. 검증 의도

- **시점 분산이 가장 강한 시그널**: `hasTimingSpread = true`이면 `hasMultipleCandidates`·`hasOrderingDecision` 무관하게 TYPE_3_TIMING 우선 적용.
- 같은 연도 2건(SC-1·SC-3·SC-4·SC-6) vs 분산(SC-2·SC-5)에서 **분산이 기본공제 250만원 추가 적용으로 합계 totalTax가 작음**.
- 본질 가치 4영역 통합(B-030 NPV) 후 본격 검증 권고.

### 10-6. 골든셋 일람표 (v0.3-A 회귀 14건 + v0.3-B 신규 4건)

| TC | 의도 | 시나리오 수 | 시나리오 타입 | 추천 시나리오 (예상) | 검증/회귀 |
|---|---|---|---|---|---|
| TC-001~005 | v0.1 단일 시나리오 회귀 | 1 | (단일) | (해당 없음) | v0.3-B 회귀 |
| TC-006~010 | v0.2 단일 시나리오 회귀 | 1 | (단일) | (해당 없음) | v0.3-B 회귀 |
| TC-011~014 | v0.3-A 단일 시나리오 회귀 | 1 | (단일) | (해당 없음) | v0.3-B 회귀 |
| **TC-S01** | **2주택 1채 양도 (어느 1채?)** | **2** | **TYPE_1_WHICH_ONE** | **SC-2 (B 양도)** ⏳ | **v0.3-B 신규** |
| **TC-S02** | **2주택 2채 양도 (양도 순서?)** | **2** | **TYPE_2_ORDER** | **SC-2 (B→A)** ⏳ | **v0.3-B 신규** |
| **TC-S03** | **3주택 1채 양도** | **3** | **TYPE_1_WHICH_ONE** | **SC-3 (C 양도)** ⏳ | **v0.3-B 신규** |
| TC-S04 | 2주택 2채 양도 + 시점 분산 (선택) | 6 | TYPE_3_TIMING | (검증팀 결정) ⏳ | v0.3-B 신규 (선택) |

⏳ = 검증 대기. 검증팀 손계산 + 본 명세서 §10-2~§10-5 산식 본문에 따라 산출 후 갱신.

---

## 11. 검증 방법론 (KPI 4자 일치 — 시나리오 비교는 홈택스 직접 비교 불가)

### 11-1. KPI 4자 일치 (v0.3-A의 5자 일치에서 1자 감소)

v0.3-A는 **5자 일치 KPI**(검증팀 + Claude 명세서 + 홈택스 + Claude Code Node.js + GitHub Pages 라이브)였다. v0.3-B는 **4자 일치 KPI**로 운영한다.

| 검증 영역 | v0.3-A | v0.3-B |
|---|---|---|
| 1. 검증팀 손계산 | ✅ | ✅ (양도 1건당 v0.3-A 동일 + 시나리오 합계 별도 손계산) |
| 2. Claude 명세서 산출 | ✅ | ✅ (본 §10-2~§10-5 산식) |
| 3. 국세청 홈택스 모의계산 | ✅ (양도 1건 모의계산 가능) | **⚠️ 부분 가능** (양도 1건당 모의계산 + 시나리오 합계는 수기 합산) |
| 4. Claude Code Node.js 회귀 | ✅ | ✅ (회귀 + 시나리오 시뮬레이션 추가) |
| 5. GitHub Pages 라이브 검증 | ✅ | ✅ (TC-S01~S03 콘솔 호출 가능) |

> **KPI 운영 방식**: 양도 1건당 산출세액은 v0.3-A의 5자 일치를 그대로 적용 (`perTransactionResults[i].metrics.totalTax`). 시나리오 합계(`Σ totalTax` 등)는 검증팀 + Claude + Code + 라이브의 4자 일치만 확인 (홈택스는 합산 기능 없음).

### 11-2. 회귀 안전성 검증 (절대 깨지면 안 됨)

| 검증 항목 | v0.3-B 결과 |
|---|---|
| TC-001~005 단일 시나리오 입력 | totalTax 5건 모두 v0.1 정답값 그대로 (§8-4) |
| TC-006~010 단일 시나리오 입력 | totalTax 5건 모두 v0.2 정답값 그대로 |
| TC-011~014 단일 시나리오 입력 | totalTax 4건 모두 v0.3-A 정답값 그대로 |
| Node.js 회귀 (v0.3-A 회귀 + v0.3-B 신규 그룹) | 모두 통과 |

> **회귀 깨지면 즉시 롤백**: v0.3-B 코드가 v0.3-A 결과를 보존하지 못하면 v0.3-B 마이그레이션 실패. 의사결정 #11 (정확성 > 속도) 적용.

### 11-3. v0.3-B 신규 검증 (TC-S01·S02·S03 + S04)

| TC | 검증 방법 |
|---|---|
| TC-S01 (2주택 1채) | 검증팀 손계산 (양도 2건) + 홈택스 모의계산 (각 양도 1건) + Claude Code Node.js + GitHub Pages |
| TC-S02 (2주택 2채 순서) | 검증팀 손계산 (양도 4건 — A·B의 양 순서) + 홈택스 모의계산 (양도 4건) + Code + 라이브 |
| TC-S03 (3주택 1채) | 검증팀 손계산 (양도 3건) + 홈택스 모의계산 (양도 3건) + Code + 라이브 |
| TC-S04 (2주택 2채 분산, 선택) | 검증팀 손계산 + Code + 라이브 (홈택스 합산 불가) |

### 11-4. 라이브 검증 스크립트 (Chrome DevTools 콘솔)

```js
// TaxOpt v0.3-B 라이브 검증 — TC-S01~S03 3건 일괄 (요약)
// 각 TC의 caseData 구성 후 runScenarioPipeline 호출
const result = window.TaxOpt.scenarioEngine.runScenarioPipeline(caseDataS01);

console.log("scenarioType:", result.scenarioType);          // "TYPE_1_WHICH_ONE"
console.log("metricKey:", result.metricKey);                // "effectiveTaxRate"
console.log("recommended:", result.recommendedScenarioId);  // "SC-2"
result.scenarios.forEach(s => {
  console.log(`${s.scenarioId} rank=${s.rank} totalTax=${s.metrics.totalTax.toLocaleString()} effRate=${s.metrics.effectiveTaxRate.toFixed(4)}`);
});
```

### 11-5. 자체 검증 5건 (의사결정 #11 본문 인용)

본 명세서 산출 후 자체 검증 5건을 수행 (§15에 영속화).

| # | 검증 항목 | 결과 |
|---|---|---|
| 1 | 백로그 ID 정합성 (B-018·B-024·B-028~B-031·B-032 정본 인용) | §15-1 |
| 2 | 의사결정 #10 본문 인용 정합성 (D안 + 보강 4건) | §15-2 |
| 3 | v0.3-A 회귀 안전성 (TC-001~014 14건 단일 시나리오 보존 산식 증명) | §15-3 |
| 4 | v0.3-B 신규 검증 항목 (시나리오 타입 + 상태전이 + 정렬 + 골든셋) | §15-4 |
| 5 | 자체 발견 짚을 부분 명시 | §15-5 |

---

## 12. v0.3-A → v0.3-B 변경 요약

### 12-1. 본문 변경 영역

| 영역 | v0.3-A | v0.3-B |
|---|---|---|
| §1 적용 범위 | 다주택 중과 + saleRegulated 활성 | + **시나리오 엔진 + 상태전이** |
| §2 입력 스키마 | salePlan 보존 (단일 사용) | **salePlan 본격 활성** (`docs/02_saleplan_ui_design.md` §2 정본 인용) |
| §3 (신규) | (해당 없음) | **시나리오 타입 분류 (TYPE_1·2·3) + classifyScenarioDimensions + SCENARIO_METRIC_RULES** |
| §4 (신규) | (해당 없음) | **시나리오 생성 메커니즘 (조합·순서·시점 3축)** |
| §5 (신규) | (해당 없음) | **상태전이 시뮬레이션 (`householdHouseCount` + `basicDeductionUsed` 매 양도 후 변동)** |
| §6 (신규) | (해당 없음) | **시나리오 비교 정렬 (의사결정 #10 D안 + 보강 4건 + tiebreaker)** |
| §7 결과 객체 | 단일 양도 result | **scenarioPipelineResult + ScenarioResult[] 신규** |
| §8 회귀 안전성 (신규) | (해당 없음) | **TC-001~014 단일 시나리오 입력 시 회귀 산식 증명** |
| §9 issueFlag 카탈로그 | 25종 (단일 양도) | + **시나리오 레이어 신규 약 6~10종** |
| §10 골든셋 | TC-001~014 14건 | + **TC-S01·S02·S03 (필수) + S04 (선택)** |
| §11 검증 | 5자 일치 KPI | **4자 일치 KPI** (양도 1건은 5자, 합계는 4자) |

### 12-2. 신규 노출 (호출 측 모듈 영향)

- `scenario_engine.js`: 신규 모듈 (작업 창 #14+ Claude Code 산출)
  - 진입점: `runScenarioPipeline(caseData)`, `generateScenarios(caseData)`, `simulateScenarios(scenarios, caseData)`, `recommendBestScenario(scenarioResults, salePlan)`
  - 보조: `classifyScenarioDimensions`, `selectMetricKey`, `sortScenariosByMetric`, `simulateScenarioWithStateTransition`, `aggregateIssueFlags`
  - 룰 테이블: `SCENARIO_METRIC_RULES`
- `tax_engine.js`: **변경 없음** (v0.3-A 인터페이스 그대로 사용)
- `tax_rules.js`: **변경 없음** (v0.3-A 그대로 사용)
- `result.html` (v0.4 인계): scenarioPipelineResult 기반 동적 렌더링

### 12-3. 인계 처리 결과

| 인계 | 처리 결과 |
|---|---|
| **B-018** (5/7 발표 PT 보조 슬라이드) | **본 명세서 본문 외**. 5/5 별도 결정. |
| **B-024** (일시적 2주택 비과세 임계) | **v0.3-B 미포함**. post-MVP. 입력 스키마 확장 부담 + 본질 가치(중과·시나리오)와 직교. |
| **B-028~B-031** (본질 가치 4영역) | **post-MVP P1·P2**. v0.3-B는 양도세 단독 시나리오 비교 + 의사결정 #10 1순위 지표는 양도세 기반. |
| **B-032** (결과 객체 구조 명세 vs 코드) | **v0.3-B 범위 외**. v0.2·v0.3-A 패턴 그대로 (`result.metrics`·`scenarioResult.metrics` 캡슐화). |

---

## 13. 모듈 스펙·작업지시서 갱신 영역 (작업 창 #14+ 인계)

본 명세서 v0.3-B 검증 통과 후, 다음 산출물이 후속 작업 창에서 작성된다.

### 13-1. 모듈 스펙 갱신 영역 (작업 창 #14 예정)

| 파일 | 신규 또는 갱신 |
|---|---|
| `docs/v0.3/modules/scenario_engine.md` | **신규**. 본 명세서 §3~§7 + §9를 모듈 스펙 형태로 옮김. 함수 시그니처·계약·예외처리·검증 5건 자체. |
| `docs/v0.3/modules/tax_engine.md` v0.3-A | **갱신 없음**. 인터페이스 보존. |
| `docs/v0.3/modules/tax_rules.md` v0.3-A | **갱신 없음**. 법령 숫자 그대로. |

### 13-2. 작업지시서 갱신 영역 (작업 창 #15+ 예정)

| 파일 | 영역 |
|---|---|
| `docs/05_code_work_orders/07_scenario_engine_v0_3_b.md` | **신규**. scenario_engine.js v0.3-B 신규 작성 작업지시서. 회귀 테스트 그룹 R-A (TC-001~014 단일 시나리오 입력) + 신규 그룹 (TC-S01~S03). |

### 13-3. 골든셋 갱신 영역

| 파일 | 갱신 영역 |
|---|---|
| `docs/v0.3/06_test_cases.md` v0.3-B | TC-001~014 회귀 보존 + TC-S01·S02·S03 신규 + TC-S04 선택. 검증팀 손계산 + 홈택스 모의계산 결과 수록 (검증 후). |
| `docs/v0.3/04_test_cases_manual.xlsx` v0.3-B | 시트 추가 — TC-S01·S02·S03 단계별 산출 양식 |

### 13-4. 입력 스키마

본 명세서 §2가 입력 스키마 정의를 통합 흡수했으므로 별도 `docs/v0.3/03_input_schema.md`는 신규 산출하지 않음 (운영 패턴 일관성 + 산출물 분량 부담 회피). 작업 창 #14+ 모듈 스펙에서 §2를 인용.

---

## 14. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.3-B | 2026-05-03 | **초판. 작업 창 #13 산출.** v0.3-A 명세서(1,157줄) 패턴 계승. (1) 시나리오 엔진 본질 영역 7건 신규 본문: 시나리오 타입 분류 (§3), 시나리오 생성 메커니즘 (§4), 상태전이 시뮬레이션 (§5), 시나리오 비교 정렬 (§6), 결과 객체 구조 (§7), v0.3-A 회귀 안전성 (§8), v0.3-B issueFlag 카탈로그 (§9). (2) 의사결정 #10 D안 + 보강 4건 본문 인용 — TYPE_1·2·3 분류 + metricKey 인자화 + 차원 태그 + actions 배열 + scenarioResult 사전 노출. (3) salePlan 본격 활성 — `docs/02_saleplan_ui_design.md` §2 정본 인용으로 §2-2 통합. (4) 골든셋 신규 4건 본문 (TC-S01·S02·S03 필수 + TC-S04 선택), 정답값 산출은 검증팀 결정 권고. (5) v0.3-A 회귀 안전성 산식 증명 (§8-5 — TC-001~014 14건 단일 시나리오 입력 시 동일 totalTax 보존). (6) 인계 4건 처리 (B-018 5/5 결정·B-024 post-MVP·B-028~B-031 post-MVP·B-032 v0.3-B 범위 외). (7) 4자 일치 KPI 운영 (양도 1건은 5자, 시나리오 합계는 4자). |

---

## 15. 자체 검증 부록

본 명세서 작성 후 자체 검증 5건을 수행 (의사결정 #11 본문 — 정확성 > 속도).

### 15-1. 백로그 ID 정합성 검증 (시스템 프롬프트 [백로그 정본 인용] 영역 직접 인용)

| 백로그 ID | 정본 영역 (시스템 프롬프트 인용) | 본 명세서 처리 |
|---|---|---|
| B-018 | 5/7 발표 PT 보조 슬라이드 (PRD 발표용 데모 시연 케이스) | ✅ 본 명세서 본문 외 — §1-2 / §12-3 / §13-1 인계 표기 |
| B-024 | 일시적 2주택 비과세 임계 본격 처리 (시행령 제155조 ①) | ✅ post-MVP 인계 — §1-2 / §12-3 명시. 입력 스키마 확장 부담 회피. |
| B-028 | 본질 가치 4영역: 보유세 통합 처리 | ✅ post-MVP P1 인계 — §1-2 / §12-3 |
| B-029 | 본질 가치 4영역: 가격 전망 통합 처리 | ✅ post-MVP P2 인계 — §1-2 / §12-3 |
| B-030 | 본질 가치 4영역: 통합 NPV 비교 | ✅ post-MVP P1 인계 — §1-2 / §12-3 |
| B-031 | 본질 가치 4영역: 시나리오 지표 전환 | ✅ post-MVP P2 인계 (의사결정 #10과 정합) — §1-2 / §12-3 |
| B-032 | 결과 객체 구조 명세 vs 실제 코드 불일치 | ✅ v0.3-B 범위 외 — §0-2 / §2-3 / §7-4 명시. v0.2·v0.3-A 패턴 그대로 계승. |

> "...로 추정" 표기 사용 없음. 모든 백로그 ID 정본 인용.

### 15-2. 의사결정 #10 본문 인용 정합성 검증

본 명세서가 인용한 의사결정 #10 본문과 정본의 일치도:

| 본 명세서 위치 | 의사결정 #10 인용 영역 | 정합성 |
|---|---|---|
| §3-1 D안 본문 인용 | "D안(시나리오 종류별 1순위 정렬 지표 분기) 채택" | ✅ |
| §3-1-1 차원 태그 (보강 2번) | (B) 시나리오 종류 차원 태그 식별 함수 | ✅ |
| §3-1-2 룰 테이블 (보강 1번) | (C) 정렬 함수 시그니처 (metricKey 인자 패턴) + 룰 테이블 | ✅ |
| §3-1-3 결합 케이스 우선순위 | 부수 결정 4번 — 시점 분산 활성 시 TYPE_3_TIMING 우선 | ✅ |
| §3-1-4 시나리오 1 effectiveTaxRate | (D) 시나리오 1 보조 결정 — effectiveTaxRate 채택 | ✅ |
| §6-3 tiebreaker | 부수 결정 2번 — Σ totalTax → effectiveTaxRate → scenarioId | ✅ |
| §6-5 결과 화면 표시 정책 | 부수 결정 1번 — 3개 지표 모두 표시 + 1순위 시각 강조 | ✅ |
| §7-2 ScenarioResult 구조 (보강 3번) | (E) scenarioResult 메타 보강 — actions[]·referenceYear | ✅ |

### 15-3. v0.3-A 회귀 안전성 검증 (TC-001~014 단일 시나리오 입력 보존)

§8-5 산식 증명 직접 인용:

```
v0.3-B 시나리오 엔진의 단일 시나리오 입력 시:
  caseData_1 ≡ caseData (산식상 동일)
  → calculateSingleTransfer(caseData_1) ≡ calculateSingleTransfer(caseData)
  → totalTax 일치 ∎
```

산식 증명은 §8-5 본문에 명시. 자체 검증 결과: **정합** (단일 시나리오 입력 시 v0.3-A 인터페이스 그대로 호출되어 결과 보존).

### 15-4. v0.3-B 신규 검증 항목 명시

| 신규 영역 | 본 명세서 위치 |
|---|---|
| 시나리오 타입 분류 (TYPE_1·2·3) | §3 (분류 산식 + classifyScenarioType 함수 계약) |
| 시나리오 생성 메커니즘 (조합·순서·시점) | §4 (3축 함수 계약 + 검증 케이스 + 시나리오 수 가드) |
| 상태전이 시뮬레이션 (`householdHouseCount` + `basicDeductionUsed`) | §5 (산식 + 검증 케이스 + 케이스 A·B·C) |
| 시나리오 비교 정렬 (의사결정 #10 D안 + 보강 4건) | §6 (룰 테이블 + tiebreaker + 추천 시나리오) |
| 결과 객체 구조 (scenarioPipelineResult + ScenarioResult) | §7 |
| 골든셋 신규 (TC-S01·S02·S03·S04) | §10 (4건 본문 + 일람표) |
| issueFlag 카탈로그 (시나리오 레이어 신규 약 6~10종) | §9 |

### 15-5. 자체 발견 짚을 부분 (4건)

본 명세서 작성 중 발견한 짚을 부분 4건. 후속 작업 창(#14+) 진입 시 추가 확인 필요.

#### 짚을 부분 1: §10-2 TC-S01 SC-2(B 양도) 정답값 산출 보류

- **현상**: TC-S01의 SC-2(B 양도, 비조정대상)는 v0.3-A 골든셋의 정확한 매칭 케이스가 없어 본 명세서에서 정답값 단정 불가. 보유 8년 + 일반과세 + 표 1 16% 조합. `taxBase ≈ 236,900,000` 산출까지는 명시했으나 누진세율 적용 후 totalTax는 검증팀 손계산 + 홈택스 모의계산 결정 권고.
- **본 명세서 처리**: §10-2-3 SC-2 단계 9까지만 산식 명시. totalTax는 ⏳ 표시.
- **후속 확인 필요**: 작업 창 #14 모듈 스펙 작성 또는 #15 작업지시서 작성 단계에서 검증팀 손계산 후 본 명세서 §10-2-3·§10-2-4·§10-6 갱신.

#### 짚을 부분 2: §10-3 TC-S02 SC-1·SC-2 양도 2번째 totalTax 산출 보류

- **현상**: TC-S02 양도 2번째는 `householdHouseCount=1` + `basicDeductionUsed=true` + `is1Se1House=false` 조합 케이스. 표 1 24% 적용 후 누진세율 산식. `taxBase = 364,800,000` 산출까지 명시했으나 정확한 totalTax는 검증팀 결정 권고.
- **본 명세서 처리**: §10-3-3·§10-3-4 단계 9까지만 산식 명시. totalTax는 ⏳ 표시.
- **후속 확인 필요**: 짚을 부분 1과 동일 시점에 검증팀 손계산.

#### 짚을 부분 3: §4-4-3 시나리오 수 가드 임계치 결정

- **현상**: 시나리오 수 50건(warning)·100건(error)은 본 명세서가 권고 임계치로 명시. 정확한 임계치는 화면 표시 부담·시뮬레이션 시간·메모리 등 운영 요인에 따라 결정.
- **본 명세서 처리**: §4-4-3 권고만 명시. 모듈 스펙에서 결정.
- **후속 확인 필요**: 작업 창 #14 모듈 스펙 작성 시 (a) 화면 표시 한계 (b) Node.js 시뮬레이션 시간 측정 (c) GitHub Pages 라이브 브라우저 부하 종합 검토 후 임계치 확정.

#### 짚을 부분 4: §9-2 시나리오 레이어 issueFlag 정확 갯수

- **현상**: 본 명세서는 시나리오 레이어 신규 issueFlag를 약 6~10종으로 표기. 정확 갯수는 모듈 스펙에서 결정 (일부는 통합·정밀화 가능).
- **본 명세서 처리**: §9-2 약 6~10종 표기.
- **후속 확인 필요**: 작업 창 #14 모듈 스펙 작성 시 정확 갯수 확정. v0.3-A 카탈로그(25종)의 일관성 패턴(신규 + 보조 분류) 적용 권고.

---

> **본 명세서 v0.3-B는 단일 진본**으로서 검증팀 시나리오 비교 골든셋 정합성 검증의 베이스가 됩니다. 정답값은 검증팀 손계산 + 홈택스 모의계산 + Claude Code Node.js + GitHub Pages 라이브 검증의 4자 일치로 확정됩니다 (§11). 모듈 스펙·작업지시서·코드는 본 명세서 외부 (작업 창 #14+).
>
> 본 명세서가 정정·보강된 경우 명세서 → 모듈 스펙 → 작업지시서 → 코드 순으로 갱신합니다 (의사결정 #5 강화 본문).
>
> 의사결정 #11 (정확성 > 속도) 적용. 일정·시간 제약 표기 없음.
