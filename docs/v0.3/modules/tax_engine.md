# tax_engine.js 모듈 스펙 v0.3-B

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.3/modules/tax_engine.md` |
| 버전 | v0.3-B (다주택 중과 + saleRegulated 활성 + **확정신고 v3 산식 5단계 신규** §5-7) |
| 상태 | 작성 완료 (2026-05-05, 작업 창 #15) |
| 작성 출처 | 작업 창 #15 (v0.3-B 모듈 스펙 합본 산출 — `tax_rules.md` + `tax_engine.md` v0.3-B 통합) |
| 대상 코드 | `js/tax_engine.js` (Claude Code 산출, v0.3-A → v0.3-B 패치, 본 모듈 스펙은 .js 본문 산출 금지 — 의사결정 #9 v9) |
| 대상 테스트 | `tests/tax_engine.test.js` (Claude Code 산출, v0.3-A → v0.3-B 패치 — `ENGINE_VERSION` strict-eq 1라인 갱신 + v0.3-B 신규 회귀 그룹) |
| 관련 작업지시서 | `docs/05_code_work_orders/v0_3_B/` (작업 창 #16 산출 예정 — 의사결정 #9 v9) |
| 관련 명세서 | `docs/v0.3/02_calc_engine_spec.md` v0.3-B (시나리오 엔진 + 상태전이 + 확정신고 v3 산식 §5-7, ⏳ 검증 대기) |
| 관련 입력 스키마 | `docs/v0.3/03_input_schema.md` v0.3-A (saleRegulated 활성 명시 — v0.3-B 변경 0건) |
| 관련 골든셋 | `docs/v0.3/06_test_cases.md` v0.3-B (TC-001~014 v0.3-A 회귀 + TC-S01~S07 v0.3-B 신규, 검증 후 갱신 예정) |
| 의존 모듈 스펙 | `docs/v0.3/modules/tax_rules.md` v0.3-B (**`HEAVY_TAX_RATE_ADDITION` + `findHeavyTaxRateAddition` v0.3-A 그대로 + `LAW_REFS.finalReturnAggregation` v0.3-B 신규 1키** — 본 작업 창 동시 산출 Part 1) |
| 이전 버전 | v0.3-A (`docs/v0.3/modules/tax_engine.md` 733줄, 5/2 KPI 100% 검증 통과, 회귀 534/0 + TC-011~014 추가) |
| 다음 버전 | post-MVP (시행령 제167조의10·11 단서 정확 처리·자동 조정대상지역 판정·본질 가치 4영역 B-028~B-031) |
| 관련 의사결정 | `docs/99_decision_log.md` #1 (중과 유예 처리), #5 강화 (법령 개정 대응 아키텍처 — §0-1), #6 (영속화 의무), #9 v9 (.js 본문 산출 금지), #10 D안 (시나리오 비교 정렬 — `scenario_engine.js` 책임), #11 (정확성 > 속도), #12 (모듈 스펙 v0.3-A 정본화), **#13 (확정신고 v3 산식 — 법 제104조 ⑤ 정확본, 본 v0.3-B §5-7 신규)** |
| 관련 백로그 | B-008 (effectiveTaxRate, v0.1 처리), B-009 (1세대1주택 비과세, v0.2 처리), B-019 (자동 보정 룰 — `householdHouseCount`·`residenceMonths` 등, §8-3), B-020 (의사결정 #5 강화), B-021 (법제처 OpenAPI 활용 검토), B-022 (양도소득세 정수 처리, v0.3-B 무영향 — §5-7 영역의 `getRateGroupKey` 정수 키는 부동소수점 회피용), B-023 (양도소득세 부칙·경과규정), B-024 (일시적 2주택 — v0.3-B 미포함, post-MVP 인계), B-028~B-031 (본질 가치 4영역 — post-MVP 인계), B-032 (결과 객체 구조 명세 vs 코드 — **v0.3-B 범위 외, v0.2.1·v0.3-A 그대로 계승**), B-033 (자동 조정대상지역 판정 — post-MVP 인계, B-021 통합) |

---

## 0. 문서 위치·역할

본 문서는 `js/tax_engine.js`의 **계약 문서 v0.3-B판**입니다. v0.3-A 모듈 스펙(733줄)을 베이스로 하여, v0.3-B 명세서가 활성화한 **확정신고 v3 산식 5단계 (법 제104조 ⑤ 정확본 — 의사결정 #13)** 의 계약을 추가합니다. v0.3-A의 13단계 단일 양도 파이프라인은 **그대로 보존**됩니다.

코드 본문(`js/tax_engine.js`)과 본 문서가 충돌하면 **본 문서를 우선**합니다. 본 문서를 변경해야 하는 경우는 v0.3-B 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신합니다.

본 문서는 **명세서 v0.3-B의 13단계 산식 + §3 다주택 중과 판정 + §5-7 확정신고 v3 산식 5단계를 그대로 코드 계약으로 옮긴 것**입니다. 산식·상수·issueFlag 발동 조건은 모두 명세서 §2~§9를 단일 정본으로 합니다. 본 문서가 명세서와 충돌하면 명세서가 우선합니다.

### 0-1. v0.3-A → v0.3-B 변경 요약

본 모듈 스펙 v0.3-B는 **v0.3-A 본문 §0~§부록을 모두 그대로 계승**하면서, **확정신고 v3 산식 5단계** 영역만 신규 추가합니다 (사용자 결정 옵션 (A) 채택 — 산식 본문 engine 측 단일 책임). v0.3-A의 21종 노출 멤버 시그니처·반환 형식은 모두 그대로 보존되며, v0.1·v0.2·v0.3-A 회귀 (TC-001~014 14건) 모두 그대로 통과해야 합니다.

| 영역 | v0.3-A | v0.3-B |
|---|---|---|
| 노출 멤버 | 21종 (v0.2 20 + v0.3-A 신규 1) | **23종** (v0.3-A 21 + v0.3-B 신규 2 — `findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount` 공개 노출) |
| **§5-7 확정신고 v3 산식 (신규)** | (해당 없음) | **신규 5단계 본문**: (1) `groupByTaxYear` (2) `calculateClause1AggregateProgressive` (1호 합산 누진) (3) `calculateClause2PerTransferWithDanSeo` (2호 단독 합계 + 단서) (4) `applyFinalReturnV3` (MAX(1호, 2호) 채택 + selection) (5) `distributeFinalTaxByShare` (양도별 비례 분배) |
| `result.steps` 필드 | v0.2 23종 + v0.3-A 신규 4종 = 27종 | + **v0.3-B 신규 4종** (`saleYear`·`finalCalculatedTax`·`finalReturnMethod`·`finalReturnDiff`) = **31종** |
| issueFlag | 활성 25종 (v0.2 18 + v0.3-A 순증 7) | **활성 27종** (v0.3-A 25 + v0.3-B 신규 2 — `FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` + `FINAL_RETURN_DAN_SEO_APPLIED`) |
| `tax_rules.js` 의존 | 26종 노출 멤버 중 19종 사용 | **26종 노출 멤버 그대로 + `LAW_REFS.finalReturnAggregation` v0.3-B 신규 1키 추가 사용** = 20종 사용 |
| 부트스트랩 가드 | v0.1 1건 + v0.2 1건 + v0.3-A 1건 (가드 2-A) | + **v0.3-B 가드 추가 없음** (확정신고 v3 산식은 engine 모듈 내부 신규 함수 — 의존성 변동 0건) |
| `ENGINE_VERSION` | `"v0.3.0-A"` | **`"v0.3.0-B"`** (의사결정 #13) |
| 13단계 단일 양도 파이프라인 | v0.2.1 본문 + v0.3-A 단계 4·9 변경 | **그대로 보존** (변경 0건 — 양도 1건당 산식은 v0.3-A 그대로) |
| 호출 위치 (확정신고 v3 산식) | (해당 없음) | **신규** — `simulateScenarioWithStateTransition`(시나리오 엔진 측 — 작업 창 #14+ 인계) 끝부분에서 `applyFinalReturnV3` + `distributeFinalTaxByShare` 호출 |

> **인터페이스 약속 (가장 중요)**: v0.3-A의 21종 노출 멤버는 모두 시그니처·반환 형식 그대로 유지. v0.3-B 패치는 **순수 추가**(addition-only)이며 v0.3-A·v0.2·v0.1 회귀 (TC-001~014 14건)를 깨지 않는다. **`tax_engine.js` v0.3-B 코드 변경 라인은 약 +250~+350 라인** (확정신고 v3 산식 5단계 + 누진 산출 헬퍼 공개 노출 + `result.steps` 신규 4종 채움 + issueFlag 신규 2종 + `ENGINE_VERSION` 1라인).

### 0-2. v0.3-A 회귀 안전성 (절대 깨지면 안 됨)

| 영역 | v0.3-B 동작 |
|---|---|
| TC-001~014 14건 totalTax | v0.3-A 정답값 100% 일치 (`applyFinalReturnV3`의 `length === 1` → `SINGLE_TRANSFER` 분기로 calculatedTax 그대로 — 의사결정 #13 회귀 안전성 영역) |
| v0.3-A 21종 노출 멤버 시그니처·반환 형식 | 변경 0건 (`ENGINE_VERSION` 1라인만 예외) |
| v0.3-A `result.steps` 27종 | 그대로 보존 (v0.3-B 신규 4종 추가) |
| v0.3-A issueFlag 25종 | 그대로 보존 (v0.3-B 신규 2종 추가 — 발동 조건 상호 배타) |
| v0.3-A 단계 4·9 본문 (다주택 중과 분기) | 변경 0건 — 양도 1건당 calculatedTax 산출은 v0.3-A 그대로 |
| `simulateScenarioWithStateTransition` 호출 위치 | scenario_engine.js (작업 창 #14+ 인계) — 본 모듈 스펙은 호출 측 책임 명시만 |

> **회귀 깨지면 즉시 롤백**: 본 모듈 스펙이 정의한 v0.3-B 영역이 v0.3-A 결과를 보존하지 못하면 v0.3-B 마이그레이션 실패. 의사결정 #11 (정확성 > 속도) 적용.

### 0-3. 본 모듈 스펙이 처리하지 않는 영역 (v0.3-B 범위 외)

v0.3-A에서 위임된 영역은 **그대로 위임**. v0.3-B 신규 위임 영역 추가:

| 영역 | 처리 시점 |
|---|---|
| **(v0.3-A 그대로) B-032 결과 객체 구조 명세 vs 코드 불일치** | **v0.3-B 범위 외**. v0.3-A·v0.2.1 패턴 그대로 따름. post-MVP 처리 |
| **(v0.3-A 그대로) 자동 조정대상지역 판정 (B-033)** | post-MVP (B-021 통합) |
| **(v0.3-A 그대로) 일시적 2주택 특례 (B-024)** | post-MVP (명세서 §1-4 옵션 (나) 미포함 채택 그대로) |
| **(v0.3-A 그대로) 시행령 제167조의10·11 단서** (중과 배제 사유, 인계 4) | post-MVP (issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` info로 v0.3-B 표시) |
| **(v0.3-A 그대로) 강남3구·용산 한시 유예** (B-023) | post-MVP (issueFlag `HEAVY_TAX_TRANSITION_NOT_HANDLED` info, 입력 필드 `contractDate` 부재로 실 발동 빈도 0) |
| **(v0.3-B 신규) 시나리오 엔진** (`scenario_engine.js`) — 매도 대상 조합·양도 순서·양도 시점 시나리오 생성 + `simulateScenarioWithStateTransition` 호출 위치 | 작업 창 #14+ 인계 (scenario_engine.md v0.3-B 신규 작성). 본 모듈 스펙은 §5-7 산식 5단계 본문만 단일 책임 |
| **(v0.3-B 신규) 본질 가치 4영역** (B-028~B-031) | post-MVP P1·P2 (보유세·가격 전망·NPV·시나리오 지표 전환) |

> **인계 1 (B-032) 명시 결정**: v0.3-A 본문 그대로 — 본 모듈 스펙 §4-1·§4-2의 결과 객체 구조 표기는 v0.2.1·v0.3-A 모듈 스펙 패턴 그대로 계승한다. 실제 코드(e36cb68)는 `result.metrics.totalTax` + `result.steps.totalTax` 캡슐화 구조이나, post-MVP 단계에서 별도 정정. v0.3-B는 명세 vs 코드 불일치를 인지하되 본 작업 범위 외로 처리.

> **인계 (시나리오 엔진) 명시**: 사용자 결정 옵션 (A) 채택 — `tax_engine.md` v0.3-B는 **§5-7 확정신고 v3 산식 5단계 본문**만 단일 책임. 산식 5단계 함수의 **호출 위치**(`simulateScenarioWithStateTransition` 끝부분)는 시나리오 엔진 모듈 스펙(`scenario_engine.md` v0.3-B, 작업 창 #14+ 인계) 책임. 본 모듈 스펙은 호출 측 약속만 명시.

---

### 0-A. v0.2.1 → v0.3-A 변경 요약 (v0.3-A 본문 인용 — 회귀 안전성 정본)

본 §0-A는 v0.3-A 모듈 스펙 §0-1의 본문을 그대로 인용한다. v0.3-B 회귀 안전성 영역은 본 §0-A의 v0.3-A 보존 영역이 그대로 보존된다는 점에 의존한다.

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

> **v0.3-A 인터페이스 약속**: v0.2.1의 20종 노출 멤버는 모두 시그니처 그대로 유지. v0.3-A 패치는 단계 4·9 본문 변경 + 1종 신규 노출 (`isHeavyTaxationApplicable`)이며 v0.2 또는 v0.1 회귀를 깨지 않는다.

---

## 1. 노출 객체

```js
window.TaxOpt.taxEngine
```

ES6 module(`import`/`export`)을 사용하지 않습니다(decision_log #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화합니다.

`window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback합니다. v0.1·v0.2와 동일.

---

## 2. 노출 멤버 (전체, v0.3-B)

> v0.2.1 노출 20종 + v0.3-A 신규 1종 = 21종은 **모두 시그니처·반환 형식 그대로 유지**한다. v0.3-B 신규 2종은 별도 표기.

| 멤버 | 타입 | 역할 | v0.3-A 변경 | **v0.3-B 변경** |
|---|---|---|---|---|
| `ENGINE_VERSION` | string | 결과 객체에 기록할 엔진 버전 식별자 | `"v0.3.0-A"`로 갱신 | **`"v0.3.0-B"`로 갱신** (의사결정 #13) |
| `calculateSingleTransfer(caseData, houseId?)` | function | 메인 진입점, 13단계 통합 실행 | 단계 4·9 본문 변경 (중과 분기 추가) | **그대로** (양도 1건당 산식은 v0.3-A 그대로 — 회귀 안전성) |
| `validateCaseData(caseData)` | function | 입력 검증 (0단계) | 동일 (saleRegulated 기존 검증 유지) | 동일 |
| `computeTransferGain(input)` | function | 1단계 양도차익 | 동일 | 동일 |
| `applyNonTaxation(transferGain, caseData)` | function | 2단계 비과세 | 동일 | 동일 |
| `applyHighValueAllocation(taxableGain, caseData)` | function | 3단계 고가주택 안분 | 동일 | 동일 |
| `computeLongTermDeduction(taxableGain, caseData)` | function | 4단계 장특공 | **본문 변경**: 중과 발동 시 `longTermDeduction = 0` (§5-A-4) | 동일 (v0.3-A 그대로) |
| `computeCapitalGainIncome(taxableGain, longTermDeduction)` | function | 5단계 양도소득금액 | 동일 | 동일 |
| `computeBasicDeduction(basicDeductionUsed)` | function | 6단계 기본공제 | 동일 | 동일 |
| `computeTaxBase(capitalGainIncome, basicDeduction)` | function | 7단계 과세표준 | 동일 | 동일 |
| `determineHoldingPeriodBranch(acquisitionDate, saleDate)` | function | 8단계 보유기간 분기 | 동일 (분기 자체 불변) | 동일 |
| `determineAppliedRate(branch, taxBase)` | function | 9단계 적용 세율 결정 | **본문 변경**: 중과 시 누진세율 + 가산세율 합산 (§5-A-9) | 동일 |
| `computeCalculatedTax(taxBase, appliedRate)` | function | 10단계 산출세액 | **본문 변경**: 중과 시 동적 재계산 (§5-A-9-1), 보유 < 2년 + 중과 시 max 비교 (§5-A-9-2) | 동일 |
| `computeLocalIncomeTax(calculatedTax)` | function | 11단계 지방소득세 | 동일 (중과 후 calculatedTax에 적용) | 동일 |
| `computeTotalTax(calculatedTax, localIncomeTax)` | function | 12단계 총 납부세액 | 동일 | 동일 |
| `computeNetAfterTaxSaleAmount(salePrice, totalTax)` | function | 13단계 세후 매각금액 | 동일 | 동일 |
| `computeEffectiveTaxRate(totalTax, salePrice)` | function | metrics 보강 (B-008) | 동일 | 동일 |
| `collectIssueFlags(caseData, intermediates)` | function | issueFlag 수집 | 활성 25종으로 확장 (§6-A) | **활성 27종으로 확장** (§6-A 신규 2종 — `FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` + `FINAL_RETURN_DAN_SEO_APPLIED`) |
| `selfTest()` | function | 부트스트랩 종합 자체검증 | TC-011·012 sanity 추가 권장 (§6-1-A) | **v0.3-B 신규 함수 sanity 추가 권장** (§6-1-B — `applyFinalReturnV3` 단일 양도 분기 sanity 1건 + `findProgressiveTaxAmount` sanity 1건) |
| `check1Se1HouseExemption(input)` | function | 1세대1주택 비과세 판단 (v0.2 신규) | 동일 | 동일 |
| `calculateHighValuePortion(input)` | function | 고가주택 안분 산식 (v0.2 신규) | 동일 | 동일 |
| `calculateLongTermDeduction(input)` | function | 장특공 표 1·2 산출 분기 (v0.2 신규) | **본문 변경**: 중과 발동 시 진입하지 않음 (상위 분기에서 차단, §5-A-4) | 동일 |
| `isHeavyTaxationApplicable(caseData, intermediates)` (v0.3-A) | function | 다주택 중과 4단계 조건 평가 (v0.3-A 신규) | v0.3-A 신규 (§5-5) | 동일 |
| **`findProgressiveTaxAmount(taxBase)`** (v0.3-B) | function | **(신규 노출)** 누진 산출세액 (제55조 ① 일반 누진세율 1회 적용) | — | **v0.3-B 신규** (§5-7-3 2단계 — 1호 합산 누진 산식 영역에서 호출) |
| **`findHeavyProgressiveTaxAmount(taxBase, addition)`** (v0.3-B) | function | **(신규 노출)** 누진 산출세액 + 가산세율 동적 재계산 (제104조 ⑦ 본문 단서) | — | **v0.3-B 신규** (§5-7-3 3단계 — 2호 단서 동일 호 세율 자산 합산 산식 영역에서 호출) |

> **노출 원칙**: v0.1·v0.2·v0.3-A와 동일. 13단계 각 함수 + v0.2 신규 보조 3종 + v0.3-A 신규 보조 1종 + **v0.3-B 신규 노출 2종**을 모두 노출하는 이유는 (1) 회귀 테스트가 단계별 중간값을 검증해야 하고, (2) **v0.3-B 신규 산식 5단계 (§5-7)** 가 `findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount`를 호출하므로 공개 노출 필요. 노출은 **읽기 전용 사용**을 전제로 한다 (불변성 약속, §7).

> **v0.3-B `findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount` 공개 노출 사유** (사용자 결정 옵션 (A) 채택 본문):
> - **`findProgressiveTaxAmount`**: §5-7-3 2단계 `calculateClause1AggregateProgressive` 영역에서 모든 자산 과세표준 합산 후 호출 (제55조 ① 일반 누진세율 1회 적용 — 가산세율 미적용).
> - **`findHeavyProgressiveTaxAmount`**: §5-7-3 3단계 `calculateClause2PerTransferWithDanSeo` 영역의 단서 발동 분기에서 호출 (동일 호 세율 자산 ≥ 2 합산 → 호별 세율 적용 → 누진 산출세액 + 가산세율 동적 재계산).
> - 두 함수는 v0.3-A에서 단계 9 내부 함수로 호출되었으나 노출되지 않았음. v0.3-B에서 §5-7 산식 5단계가 본 함수를 호출해야 하므로 공개 노출로 격상.
> - **v0.3-A 회귀 안전성**: 본 2종은 v0.3-A에서도 단계 9 내부 함수로 동작했으므로, 공개 노출 격상은 시그니처·반환값 변동 0건. 회귀 영향 0건.

> **v0.3-B 노출 멤버 합계 검산**: v0.1 17종 + v0.2 신규 3종 + v0.3-A 신규 1종 (`isHeavyTaxationApplicable`) + **v0.3-B 신규 2종 (`findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount`) = 23종**.

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

명세서 v0.3-A §3-7 표 그대로 옮김.

| 필드 | 타입 | 단계 | 의미 |
|---|---|---|---|
| **`isHeavyTaxation`** | boolean | 단계 4 진입 직전 산출 | 다주택 중과 적용 여부 (§5-5 `isHeavyTaxationApplicable` 결과). v0.3-A 핵심 분기 플래그 |
| **`heavyRateAddition`** | number \| null | 단계 4·9 | 가산세율 (`0.20`·`0.30`·`null`). 중과 미적용 시 `null` |
| **`shortTermTax`** | number \| null | 단계 9 (보유 < 2년 + 중과 분기) | 단기세율 산출세액 (max 비교용). 그 외 케이스 `null` |
| **`heavyProgressiveTax`** | number \| null | 단계 9 (보유 < 2년 + 중과 분기) | 중과 누진세율 산출세액 (max 비교용). 그 외 케이스 `null` |

> **`shortTermTax`·`heavyProgressiveTax`가 `null`인 케이스**: (a) 중과 미적용, 또는 (b) 중과 적용 + 보유 ≥ 2년 (이 경우는 max 비교 자체가 없음). max 비교 트레이스가 필요 없는 케이스에 `0`이 아닌 `null`로 채우는 이유는, 호출 측이 `=== null` 비교로 "비교가 발생하지 않은 케이스"를 명시적으로 식별하기 위함이다.

#### 4-2-2-B. v0.3-B 신규 4종 (확정신고 v3 산식 트레이스)

명세서 v0.3-B §5-7-3 본문 인용. 본 4종 필드는 **확정신고 v3 산식 5단계 (§5-7) 처리 후** 양도별 결과 객체에 채워진다.

| 필드 | 타입 | 단계 | 의미 |
|---|---|---|---|
| **`saleYear`** | number | 양도일 산출 직후 | 양도일이 속하는 과세연도 (양도일의 연도 부분). §5-7-3 1단계 `groupByTaxYear`에서 그룹화 키로 사용 |
| **`finalCalculatedTax`** | number | §5-7 산식 5단계 처리 후 | 확정신고 v3 산식 적용 후 양도별 산출세액 (Math.floor 적용). 단일 양도 (length === 1) 시 = `calculatedTax` 그대로. 다중 양도 시 = MAX(1호, 2호) × (calculatedTax / Σ calculatedTax) 비례 분배 |
| **`finalReturnMethod`** | string | §5-7-3 4단계 `applyFinalReturnV3` 결과 | 확정신고 산식 채택 영역 식별: `"SINGLE_TRANSFER"` / `"CLAUSE_1_AGGREGATE_PROGRESSIVE"` / `"CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO"` |
| **`finalReturnDiff`** | number | §5-7-3 4단계 결과 | 확정신고 영역 차이 (`finalReturnTax − Σ calculatedTax`). 단일 양도 시 0. 1호 채택 시 양수 가능 (1호 합산 누진이 자산별 단독보다 클 때). 2호 채택 + 단서 발동 시 양수 가능 |

> **본 4종은 명세서 v0.3-B §5-7-3 본문에서 도출**: 1단계 `groupByTaxYear`가 `saleYear` 사용, 4단계 `applyFinalReturnV3`이 `finalReturnMethod` + `finalReturnDiff` 산출, 5단계 `distributeFinalTaxByShare`가 `finalCalculatedTax` 채움. v0.3-B `result.steps`는 본 4종 필드를 통해 확정신고 v3 산식의 적용 영역을 호출 측이 트레이스 가능하게 한다.

> **`finalReturnMethod === "SINGLE_TRANSFER"` 케이스 (회귀 안전성 영역)**: 단일 양도 입력 (TC-001~014 14건) 시 `applyFinalReturnV3`의 `length === 1` 분기 진입 → `finalCalculatedTax = calculatedTax` 그대로 → totalTax 100% 일치. 의사결정 #13 회귀 안전성 영역.

> **`finalCalculatedTax`와 `calculatedTax` 관계**: `calculatedTax`는 v0.3-A 단계 9·10 산출 결과 (양도 1건 단독 누진 또는 중과 누진). `finalCalculatedTax`는 §5-7 확정신고 v3 산식 적용 후 산출 결과. 단일 양도 시 두 값 동일. 다중 양도 시 호출 측 (`scenario_engine.js`)이 양도별 비례 분배 적용한 값. 후속 단계 11 (지방소득세) + 12 (총 납부세액)는 **`finalCalculatedTax`** 기준으로 재산출 (명세서 §5-7-4 본문).

#### 4-2-3. `terminateAt2 === true`일 때의 후속 단계 값 일관성 (v0.2.1 그대로 + v0.3-A 신규 4종 + v0.3-B 신규 4종 정책)

v0.2.1 §4-2-1 표 그대로 적용. v0.3-A 신규 4종 + v0.3-B 신규 4종 필드는 다음으로 채운다:

| 필드 | terminateAt2=true 시 값 | 사유 |
|---|---|---|
| `isHeavyTaxation` (v0.3-A) | `false` | 단계 2 종료, 중과 판정 미실행 |
| `heavyRateAddition` (v0.3-A) | `null` | (동일) |
| `shortTermTax` (v0.3-A) | `null` | (동일) |
| `heavyProgressiveTax` (v0.3-A) | `null` | (동일) |
| **`saleYear`** (v0.3-B) | 양도일의 연도 (정상 채움) | 단계 2 종료와 무관하게 양도일은 입력 영역. 정상 채움 |
| **`finalCalculatedTax`** (v0.3-B) | `0` | 비과세 케이스 → calculatedTax = 0 → 단일 양도 분기 → finalCalculatedTax = 0 |
| **`finalReturnMethod`** (v0.3-B) | `"SINGLE_TRANSFER"` | 단일 양도 입력 (terminateAt2=true 케이스는 비과세 처리이므로 항상 단일 시나리오) |
| **`finalReturnDiff`** (v0.3-B) | `0` | 단일 양도 분기 → diff = 0 |

> **회귀 안전성**: v0.1·v0.2 골든셋(TC-001~010) + v0.3-A 골든셋(TC-011~014) 14건은 모두 단일 양도 입력. terminateAt2=true 케이스 (TC-006·TC-009 등 1세대1주택 비과세) + terminateAt2=false 케이스 모두 v0.3-B 신규 4종 필드는 `finalReturnMethod = "SINGLE_TRANSFER"` + `finalCalculatedTax = calculatedTax` + `finalReturnDiff = 0`으로 채워진다. v0.1·v0.2·v0.3-A 결과 객체와 비교 시 v0.3-B 신규 4종 필드를 무시하면 100% 동일.

---

## 5. 13단계 파이프라인 함수 계약 (v0.3-A 변경분 + v0.3-B 신규 §5-7)

> 본 절은 v0.2.1과 **달라진 단계 4·9·10** + **v0.3-A 신규 함수 1종(§5-5)** + **v0.3-B 신규 §5-7 (확정신고 v3 산식 5단계)** 만 다룬다. 단계 0·1·2·3·5·6·7·8·11·12·13 본문은 v0.2.1 모듈 스펙과 **완전 동일**하므로 본 문서에서 재정의하지 않는다.

### 5-1. 단계 2·3 — v0.2.1 그대로 (변경 없음)

v0.2.1 모듈 스펙 §5-1 (`applyNonTaxation` + `check1Se1HouseExemption`) + §5-2 (`applyHighValueAllocation` + `calculateHighValuePortion`)와 **완전 동일**. 본 문서에서 재정의 없음.

> **v0.3-A 영향**: 단계 2 종료 시 `is1Se1House` 출력은 v0.3-A에서 §5-5 `isHeavyTaxationApplicable` 조건 4(1세대1주택 비과세 미적용)의 입력으로 추가 사용된다. 단계 2 본문은 변경 없음.

> **v0.3-B 영향**: 단계 2 본문 변경 0건. 양도일 산출 직후 `saleYear` 채움은 단계 0 (validateCaseData) 또는 단계 1 (transferGain 산출 직전) 단계에서 처리. 본 모듈 스펙은 호출 측 책임 명시.

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

### 5-7. v0.3-B 신규 — 확정신고 v3 산식 5단계 (법 제104조 ⑤ 정확본)

#### 5-7-1. §섹션 영역 (사용자 결정 옵션 (A) 채택 — 산식 본문 engine 측 단일 책임)

본 §5-7은 v0.3-B 신규 §섹션이다. 명세서 v0.3-B §5-7-3 본문을 단일 진본으로 인용하여 작성된다. 본 §5-7과 명세서가 충돌하면 명세서가 우선.

**산식 본문 위치 결정** (사용자 결정 옵션 (A) 본문 영속화):

| 영역 | 본문 |
|---|---|
| 산식 5단계 본문 | **`tax_engine.md` v0.3-B §5-7 (본 §섹션)** — 단일 진본 |
| 호출 위치 | `simulateScenarioWithStateTransition` 끝부분 (`scenario_engine.js` v0.3-B — 작업 창 #14+ 인계, `scenario_engine.md` v0.3-B 신규 작성) |
| `findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount` 노출 | 본 모듈 §2 v0.3-B 신규 노출 2종 (산식 5단계가 호출하므로 공개 노출 격상) |
| LAW_REFS | `tax_rules.md` v0.3-B §3-6-2-B `finalReturnAggregation` 1키 |
| issueFlag | 본 모듈 §6-A 카탈로그 신규 2종 (`FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` + `FINAL_RETURN_DAN_SEO_APPLIED`) |

#### 5-7-2. 법령 본문 (법 제104조 제5항 정확본)

본 §섹션의 모든 산식은 다음 법령 본문을 단일 정본으로 한다:

> **소득세법 제104조 제5항** ⑤ 해당 과세기간에 제94조제1항제1호·제2호 및 제4호에서 규정한 자산을 둘 이상 양도하는 경우 양도소득 산출세액은 다음 각 호의 금액 중 큰 것으로 한다.
> 1. 해당 과세기간의 양도소득과세표준 합계액에 대하여 제55조제1항에 따른 세율을 적용하여 계산한 양도소득 산출세액
> 2. 제1항부터 제4항까지 및 제7항의 규정에 따라 계산한 자산별 양도소득 산출세액 합계액. 다만, 둘 이상의 자산에 대하여 제1항 각 호, 제4항 각 호 및 제7항 각 호에 따른 세율 중 동일한 호의 세율이 적용되고, 그 적용세율이 둘 이상인 경우 해당 자산에 대해서는 각 자산의 양도소득과세표준을 합산한 것에 대하여 제1항·제4항 또는 제7항의 각 해당 호별 세율을 적용하여 산출한 세액 중에서 큰 산출세액의 합계액으로 한다.

> **사용자 39번째 짚음 정정 영역**: 시행령 제167조의10은 다주택 중과 자산 정의 조문일 뿐. 법 제104조 ⑤ 적용 영역에서 시행령 제167조의10을 "자산별 단독 과세 근거"로 인용하는 것은 잘못. 본 §5-7 영역에서 시행령 제167조의10 인용 0건 — `LAW_REFS.finalReturnAggregation` = "소득세법 제104조 제5항(본문·1호·2호 본문·2호 단서) + 제55조 제1항"만 인용.

#### 5-7-3. 5단계 산식 본문 (명세서 §5-7-3 본문 단일 진본 인용)

##### 1단계 — `groupByTaxYear(perTransferResults)` 함수 계약

| 항목 | 내용 |
|---|---|
| 입력 | `perTransferResults: TaxResult[]` (시나리오 내 모든 양도 결과 배열) |
| 출력 | `Map<number, TaxResult[]>` (key = saleYear, value = 동일 과세연도 양도 결과 배열) |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 (Map 순회 순서 결정성은 호출 측 책임) |
| 호출 측 | `simulateScenarioWithStateTransition` 끝부분 (`scenario_engine.js`) |
| 예외 | `r.saleYear`가 비정수·NaN·undefined일 때 throw (입력 검증 영역) |

**의사코드** (명세서 §5-7-3 1단계 본문 그대로):

```js
function groupByTaxYear(perTransferResults) {
  const groups = new Map();
  for (const r of perTransferResults) {
    const year = r.saleYear; // 양도일 속하는 과세연도 (result.steps.saleYear)
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(r);
  }
  return groups;
}
```

> **`saleYear` 값**: `result.steps.saleYear` 필드 (§4-2-2-B v0.3-B 신규 4종 중 1종). 양도일의 연도 부분 (예: 2026-09-15 → 2026).

##### 2단계 — `calculateClause1AggregateProgressive(perTransferResultsSameYear)` 함수 계약 (1호 합산 누진)

| 항목 | 내용 |
|---|---|
| 입력 | `perTransferResultsSameYear: TaxResult[]` (동일 과세연도 양도 결과 배열, 길이 ≥ 1) |
| 출력 | `number` (1호 산출세액 — 모든 자산 과세표준 합산 × 제55조 ① 일반 누진세율 1회 적용) |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 호출 측 | `applyFinalReturnV3` 함수 내부 (§5-7-3 4단계) |
| 의존 함수 | `findProgressiveTaxAmount(taxBase)` (§2 v0.3-B 신규 노출 1종) |

**의사코드** (명세서 §5-7-3 2단계 본문 그대로):

```js
function calculateClause1AggregateProgressive(perTransferResultsSameYear) {
  // 모든 자산 과세표준 합산 (중과 자산 포함)
  const totalTaxBase = perTransferResultsSameYear.reduce(
    (sum, r) => sum + r.taxBase, 0
  );
  
  // 제55조 ① 일반 누진세율 1회 적용 (가산세율 미적용)
  return findProgressiveTaxAmount(totalTaxBase);
}
```

> **사용자 39번째 짚음 정정 영역**: v2 잘못 정정안 → "1호 합산을 일반과세 자산만으로 좁게 적용". v3 정확본 → **모든 자산 과세표준 합산** (중과 자산 포함). 1호 적용 영역에서 자산 종류별 분리 0건. 사유: 법 제104조 ⑤ 1호 본문은 "해당 과세기간의 양도소득과세표준 합계액"으로 명시 — 모든 자산 합산.

> **가산세율 미적용 사유**: 1호는 "제55조제1항에 따른 세율"만 인용 — 제104조 ⑦(다주택 중과)는 1호 영역 미적용. 일반 누진세율 1회 적용.

##### 3단계 — `calculateClause2PerTransferWithDanSeo(perTransferResultsSameYear)` 함수 계약 (2호 단독 합계 + 단서)

| 항목 | 내용 |
|---|---|
| 입력 | `perTransferResultsSameYear: TaxResult[]` (동일 과세연도 양도 결과 배열, 길이 ≥ 1) |
| 출력 | `number` (2호 산출세액 — 자산별 단독 합계 + 단서 발동 시 동일 호 세율 자산 합산) |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 호출 측 | `applyFinalReturnV3` 함수 내부 (§5-7-3 4단계) |
| 의존 함수 | `findProgressiveTaxAmount(taxBase)` (1호 단서 발동 시 일반 누진세율) + `findHeavyProgressiveTaxAmount(taxBase, addition)` (중과 단서 발동 시 가산세율 적용 누진세율) — 둘 다 §2 v0.3-B 신규 노출 |
| 보조 함수 | `getRateGroupKey(addition)` 정수 키 헬퍼 (5/4 합의 결정 1번 — B-022 부동소수점 회피) |

**의사코드** (명세서 §5-7-3 3단계 본문 그대로):

```js
function calculateClause2PerTransferWithDanSeo(perTransferResultsSameYear) {
  // 그룹화: heavyRateAddition 별 (0.0=일반, 0.20=2주택, 0.30=3주택)
  // 부동소수점 회피용 정수 키 (B-022 — 5/4 합의 결정 1번)
  const byHeavyAddition = new Map();
  for (const r of perTransferResultsSameYear) {
    const addition = r.heavyRateAddition !== null ? r.heavyRateAddition : 0.0;
    const key = getRateGroupKey(addition);   // 정수 키 — Math.round 패턴
    if (!byHeavyAddition.has(key)) byHeavyAddition.set(key, { addition, group: [] });
    byHeavyAddition.get(key).group.push(r);
  }
  
  let total = 0;
  for (const [key, { addition, group }] of byHeavyAddition.entries()) {
    if (group.length >= 2) {
      // 단서 발동: 동일 호 세율 자산 ≥ 2 → 합산 후 호별 세율 + MAX(합산, 단독) 채택
      const sumBase = group.reduce((s, r) => s + r.taxBase, 0);
      const aggregatedInGroup = (addition === 0.0)
        ? findProgressiveTaxAmount(sumBase)            // 일반 누진세율
        : findHeavyProgressiveTaxAmount(sumBase, addition);   // 가산세율 적용 누진세율
      const sumSolo = group.reduce((s, r) => s + r.calculatedTax, 0);
      // MAX(합산 결과, 단독 합계) 그룹별 채택
      total += Math.max(aggregatedInGroup, sumSolo);
    } else {
      // 단일 자산: 단독 그대로 (단서 미발동)
      total += group[0].calculatedTax;
    }
  }
  return total;
}

// 정수 키 헬퍼 (B-022 부동소수점 회피 — 5/4 합의 결정 1번)
function getRateGroupKey(addition) {
  // 0.0 → "clause1_addition_0", 0.20 → "clause1_addition_20", 0.30 → "clause1_addition_30"
  return "clause1_addition_" + Math.round(addition * 100).toString();
}
```

> **5/4 합의 결정 1번 본문** (정수 키 채택 사유): JavaScript에서 `0.1 + 0.2 !== 0.3` 부동소수점 정합성 문제 회피. `addition` 값은 0.0·0.20·0.30 3종으로 한정되므로 `Math.round(addition * 100)` 패턴으로 정수 키 생성. Map의 키 비교가 결정성 보장.

> **5/4 합의 결정 2번 본문** (v0.3-A 누적 baseTax 산식 채택 사유): `findHeavyProgressiveTaxAmount`은 v0.3-A §5-A-9-1 본문의 누적 baseTax 산식을 그대로 사용 (Python 표준 누진공제 산식 미사용). 사유: v0.3-A 본문이 단일 진본이며 산식 변경 시 회귀 영향 발생 가능. v0.3-A 본문 그대로 보존이 v0.3-A 회귀 안전성 영역에 정합.

##### 4단계 — `applyFinalReturnV3(perTransferResultsSameYear)` 함수 계약 (MAX(1호, 2호) 채택 + selection)

| 항목 | 내용 |
|---|---|
| 입력 | `perTransferResultsSameYear: TaxResult[]` (동일 과세연도 양도 결과 배열, 길이 ≥ 0) |
| 출력 | `{ finalReturnTax: number, method: string, diff: number, aggregateTaxClause1?: number, aggregateTaxClause2?: number, perTransferTax?: number }` |
| 부수효과 | 없음 |
| 결정성 | 동일 입력 → 동일 출력 |
| 호출 측 | `simulateScenarioWithStateTransition` 끝부분 (`scenario_engine.js`) |
| 의존 함수 | `calculateClause1AggregateProgressive` + `calculateClause2PerTransferWithDanSeo` (§5-7-3 2·3단계) |
| selection 분기 | `length === 0` → `{ finalReturnTax: 0, method: "NONE", diff: 0 }` / `length === 1` → **`SINGLE_TRANSFER` 분기** (회귀 안전성 영역) / `length >= 2` → MAX(1호, 2호) 채택 |

**의사코드** (명세서 §5-7-3 4단계 본문 그대로):

```js
function applyFinalReturnV3(perTransferResultsSameYear) {
  if (perTransferResultsSameYear.length === 0) {
    return { finalReturnTax: 0, method: "NONE", diff: 0 };
  }
  
  if (perTransferResultsSameYear.length === 1) {
    // ★ SINGLE_TRANSFER 분기 — TC-001~014 회귀 안전성 영역 (5/4 합의 결정 3번 채택)
    const r = perTransferResultsSameYear[0];
    return {
      finalReturnTax: r.calculatedTax,   // v0.3-A 산출세액 그대로
      method: "SINGLE_TRANSFER",
      diff: 0,
    };
  }
  
  // 1호·2호 산출
  const clause1Tax = calculateClause1AggregateProgressive(perTransferResultsSameYear);
  const clause2Tax = calculateClause2PerTransferWithDanSeo(perTransferResultsSameYear);
  
  // 자산별 단독 합계 (예정신고 비교 영역)
  const perTransferTotal = perTransferResultsSameYear.reduce(
    (s, r) => s + r.calculatedTax, 0
  );
  
  // MAX 채택
  const finalReturnTax = Math.max(clause1Tax, clause2Tax);
  const method = (finalReturnTax === clause1Tax)
    ? "CLAUSE_1_AGGREGATE_PROGRESSIVE"
    : "CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO";
  
  return {
    finalReturnTax,
    method,
    diff: finalReturnTax - perTransferTotal,
    aggregateTaxClause1: clause1Tax,
    aggregateTaxClause2: clause2Tax,
    perTransferTax: perTransferTotal,
  };
}
```

> **5/4 합의 결정 3번 본문** (`length === 1` → `SINGLE_TRANSFER` 분기 채택 사유): TC-001~014 14건은 모두 단일 양도 입력. 본 분기 진입 시 `finalReturnTax = r.calculatedTax` 그대로 → totalTax 100% 일치. 의사결정 #13 회귀 안전성 영역 정본.

> **MAX 채택 검증 영역**: xlsx 시트 19 (산식정정_v3) 본문 직접 인용 — 모든 시나리오 (TC-S05·S06·S07) method = `CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO` (2호 채택). 사유: 다주택 중과 적용 자산 1건 이상 시 2호 산출세액이 1호보다 항상 큼. 1호 채택 발동 케이스 (모든 자산 일반과세 + 양도차익 작은 케이스)는 검증팀 정확 검증 영역.

##### 5단계 — `distributeFinalTaxByShare(perTransferResultsSameYear, finalReturnResult)` 함수 계약 (양도별 비례 분배)

| 항목 | 내용 |
|---|---|
| 입력 | `perTransferResultsSameYear: TaxResult[]`, `finalReturnResult: { finalReturnTax, method, ... }` |
| 출력 | (부수효과로 `perTransferResultsSameYear[i].finalCalculatedTax` 채움) |
| 부수효과 | **있음** — `result.steps.finalCalculatedTax` 필드 mutation (호출 측 책임) |
| 결정성 | 동일 입력 → 동일 출력 |
| 호출 측 | `simulateScenarioWithStateTransition` (`applyFinalReturnV3` 호출 직후) |
| 분배 산식 | 양도별 `calculatedTax / Σ calculatedTax` 비율 × `finalReturnTax` (Math.floor 적용) |

**의사코드** (명세서 §5-7-3 5단계 본문 그대로):

```js
function distributeFinalTaxByShare(perTransferResultsSameYear, finalReturnResult) {
  if (finalReturnResult.method === "SINGLE_TRANSFER") {
    // 단일 양도 분기 — finalCalculatedTax = calculatedTax 그대로
    perTransferResultsSameYear[0].finalCalculatedTax = 
      finalReturnResult.finalReturnTax;
    return;
  }
  
  const totalCalc = perTransferResultsSameYear.reduce(
    (s, r) => s + r.calculatedTax, 0
  );
  
  if (totalCalc === 0) {
    // 전체 비과세 케이스 — 분배 0
    for (const r of perTransferResultsSameYear) r.finalCalculatedTax = 0;
    return;
  }
  
  for (const r of perTransferResultsSameYear) {
    const share = r.calculatedTax / totalCalc;
    r.finalCalculatedTax = Math.floor(finalReturnResult.finalReturnTax * share);
  }
}
```

> **부수효과 영역**: 본 함수는 `result.steps.finalCalculatedTax`를 mutation한다. 본 모듈 §7 불변성 약속 (v0.2.1 + v0.3-A) 영역의 예외 — v0.3-B 산식 5단계 처리 후에만 1회 mutation 허용. 호출 측은 본 mutation을 인지한 후 `localIncomeTax`·`totalTax`·`netAfterTaxSaleAmount`·`effectiveTaxRate` 재산출 (호출 측 `simulateScenarioWithStateTransition` 책임).

> **반올림 vs 절사**: `Math.floor` 적용 — v0.3-A 단계 9·10·11의 절사 정책과 정합 (B-022 정수 처리 영역).

> **분배 후 합계 vs 원본 합계**: 분배 후 `Σ finalCalculatedTax`는 `floor` 누적 손실로 `finalReturnTax`보다 약간 작을 수 있음 (최대 N−1원, N = 양도 개수). xlsx 시트 19 검증 결과 — TC-S06 SC-3에서 **−1원 차이** 발생 (894,816,998 → 894,816,997). 본 차이는 v3 산식 본문의 정합 영역 (상호 배타 분배). 호출 측은 본 차이를 issueFlag로 표시 미고려 (검증 영역).

#### 5-7-4. 호출 위치 (`simulateScenarioWithStateTransition` 끝부분)

본 §5-7-4는 산식 5단계의 호출 위치를 명시한다. **호출 본문은 `scenario_engine.js` 모듈 (작업 창 #14+ 인계) 책임**이며, 본 모듈 스펙은 호출 측 약속만 명시한다.

```js
// scenario_engine.js v0.3-B (작업 창 #14+ 산출 — 본 모듈 스펙은 호출 측 책임 명시만)
function simulateScenarioWithStateTransition(scenario, caseData) {
  // 기존 본문: 양도별 calculateSingleTransfer 호출 + 상태전이
  const perTransferResults = [...]; // 기존 처리 (v0.3-A 그대로)
  
  // ★ v0.3-B 신규: 확정신고 v3 산식 5단계 호출
  const yearGroups = groupByTaxYear(perTransferResults);   // 1단계
  const finalReturnSummary = new Map();
  
  for (const [year, results] of yearGroups.entries()) {
    const fr = applyFinalReturnV3(results);                // 4단계 (2·3단계 내부 호출)
    finalReturnSummary.set(year, fr);
    distributeFinalTaxByShare(results, fr);                // 5단계
  }
  
  // 양도별 totalTax 재산출 (finalCalculatedTax 기준)
  for (const r of perTransferResults) {
    r.localIncomeTax = Math.floor(r.finalCalculatedTax * 0.10);
    r.totalTax = r.finalCalculatedTax + r.localIncomeTax;
    r.netAfterTaxSaleAmount = r.expectedSalePrice - r.totalTax;
    r.effectiveTaxRate = r.expectedSalePrice > 0 
      ? r.totalTax / r.expectedSalePrice : 0;
  }
  
  return {
    perTransferResults,
    finalReturnSummary: Object.fromEntries(finalReturnSummary),
    // ... 기존 반환 영역
  };
}
```

> **호출 측 책임 영역 (인계)**: 본 모듈 스펙은 **산식 5단계 본문**만 단일 책임. 호출 위치·결과 mutation·`localIncomeTax`·`totalTax`·`netAfterTaxSaleAmount`·`effectiveTaxRate` 재산출은 모두 `scenario_engine.js` 모듈 (작업 창 #14+ 인계) 책임.

> **사용자 결정 옵션 (A) 본문 영속화 영역**: 본 §5-7-4 의사코드는 **참고용** — 본 모듈 스펙은 호출 위치 명시만 단일 책임. 실제 호출 본문은 `scenario_engine.md` v0.3-B (신규 작성) 정본.

#### 5-7-5. v0.3-A 회귀 안전성 산식 증명

| 영역 | 처리 |
|---|---|
| TC-001~014 14건 (단일 양도 입력) | `applyFinalReturnV3` 호출 시 `length === 1` → `SINGLE_TRANSFER` 분기 → `finalReturnTax = r.calculatedTax` 그대로 → `distributeFinalTaxByShare`도 `length === 1` 분기 → `finalCalculatedTax = calculatedTax` 그대로 → totalTax 100% 일치 |
| 단일 시나리오 입력 | 동일 (시나리오 = 양도 1건) |
| 본 §5-7 영역 도입의 v0.3-A 영향 | **0건** (단일 양도 분기 진입 시 v0.3-A 결과 그대로 보존) |
| KPI 5자 일치 누적 14건 | 보존 보장 (의사결정 #13 본문) |

산식 증명:

```
v0.3-B 단일 양도 입력:
  perTransferResults = [r_1] (length 1)
  
  1단계 groupByTaxYear: groups = { saleYear_1: [r_1] }
  
  4단계 applyFinalReturnV3(groups[saleYear_1]):
     length === 1 → SINGLE_TRANSFER 분기
     return { finalReturnTax: r_1.calculatedTax, method: "SINGLE_TRANSFER", diff: 0 }
  
  5단계 distributeFinalTaxByShare:
     method === "SINGLE_TRANSFER" → r_1.finalCalculatedTax = r_1.calculatedTax
  
  결과:
     r_1.finalCalculatedTax = r_1.calculatedTax (v0.3-A 정답값)
     r_1.localIncomeTax = floor(r_1.finalCalculatedTax * 0.10) = floor(r_1.calculatedTax * 0.10) (v0.3-A 그대로)
     r_1.totalTax = r_1.finalCalculatedTax + r_1.localIncomeTax (v0.3-A 그대로)
  
  → TC-001~014 14건 totalTax 100% 일치 ∎
```

> **회귀 깨지면 즉시 롤백**: 본 산식 증명이 실제 코드에서 깨지면 v0.3-B 마이그레이션 실패. 의사결정 #11 (정확성 > 속도) 적용.

#### 5-7-6. v0.3-B 신규 검증 영역 (TC-S05·S06·S07)

xlsx 시트 19 (산식정정_v3) 본문 직접 인용 — v3 산식 적용 결과:

| TC | 시나리오 | v3 Σ totalTax | method |
|---|---|---|---|
| TC-S05 | SC-1 (A→C) | 606,694,000 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |
| TC-S05 | SC-2 (C→A) | 521,911,500 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |
| TC-S05 | SC-3 (B→C) | 296,438,998 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |
| TC-S05 | SC-4 (C→B) | **255,051,500** ★ rank 1 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |
| TC-S06 | SC-1 (A→B→C) | 960,212,000 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |
| TC-S06 | SC-3 (B→A→C) | **894,816,997** | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO (v2 894,816,998 → v3 894,816,997, 차이 −1) |
| TC-S06 | SC-6 (C→B→A) | **296,453,076** ★ rank 1 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |
| TC-S07 | SC-6 (C→B 분산 [2026, 2027]) | **253,401,500** ★ rank 1 | SINGLE_TRANSFER (분산 양도는 각 연도 단독) |
| TC-S07 | SC-4 (C→B 동일 연도) | 255,051,500 | CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO |

> **검증 영역 단일 진본**: xlsx 시트 19 본문 그대로. 본 모듈 스펙은 정답값 인용만 단일 보유. 검증팀 손계산 + 홈택스 모의계산 일치 여부는 별도 KPI 4자 일치 운영 영역 (명세서 v0.3-B §11-3).

> **과세기간 분산 효과 (TC-S07 SC-4 vs SC-6)**: SC-4 (동일 연도 C→B) 255,051,500 → SC-6 (분산 [2026, 2027]) 253,401,500 = **1,650,000원 절세** (분산 양도는 각 연도 단독 → SINGLE_TRANSFER 분기 → 기본공제 250만원 1회 추가 + 동일 과세기간 다중 양도 회피).

#### 5-7-7. issueFlag 신규 2종 (§6-A 카탈로그 v0.3-B 신규)

| issueFlag | severity | 발동 조건 | 메시지 (요약) |
|---|---|---|---|
| `FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` | info | TYPE_2_ORDER 또는 TYPE_3_TIMING 시나리오에서 `method === "CLAUSE_1_AGGREGATE_PROGRESSIVE"` 발동 | 동일 과세기간 다중 양도로 합산 누진 적용. 자산별 단독보다 큼 → 1호 채택 |
| `FINAL_RETURN_DAN_SEO_APPLIED` | info | `method === "CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO"` + 단서 발동 (동일 호 세율 자산 ≥ 2) | 동일 세율 자산 합산 단서 적용. MAX(합산, 단독) 채택 |

§6-A 표 끝에 26·27번째 행 추가 — §6-A 카탈로그 v0.3-A 25종 → v0.3-B 27종.

### 5-8. 단계 11·12·13 — v0.2.1 그대로 (변경 없음)

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

#### 6-A-5. v0.3-A 활성 카탈로그 합계

`v0.2.1 18종 + v0.3-A 신규 5종 + 보조 3종 − 폐기 1종 = 활성 25종`

> **명세서 §3-6 카운팅과의 정합성**: 명세서 §3-6에서는 "신규 5종 + 보조 3종 = 8종 신규" 표기와 폐기 1종을 포함해 순증 7종으로 계산. 본 문서 카운팅(활성 25종 = v0.2.1 18종 − 폐기 1종 + 신규 8종)과 동일 (검산: 18 − 1 + 8 = 25).

> **`caseData` 시스템 프롬프트의 "신규 7종" 표기와의 차이**: 시스템 프롬프트 일부 위치는 "신규 7종"으로 표기되어 있으나, 명세서 §3-6 정본은 "신규 5종 + 보조 3종 = 8종 신규 (폐기 1 포함 시 순증 7)"이다. 본 모듈 스펙은 명세서 정본을 채택.

### 6-B. v0.3-B issueFlag 카탈로그 변경분 (확정신고 v3 산식 신규 2종)

v0.3-B는 v0.3-A 활성 카탈로그 25종에 **신규 2종**을 추가한다. 발동 조건·메시지·LAW_REFS 매핑은 명세서 v0.3-B §5-7-6 + §9-2 본문 그대로.

#### 6-B-1. 신규 2종 (확정신고 v3 산식 영역)

| 코드 | 발동 조건 (intermediates 기준) | severity | 비고 |
|---|---|---|---|
| `FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` | TYPE_2_ORDER 또는 TYPE_3_TIMING 시나리오에서 `finalReturnMethod === "CLAUSE_1_AGGREGATE_PROGRESSIVE"` 발동 | info | 동일 과세기간 다중 양도로 합산 누진 적용 (1호 채택). 자산별 단독보다 큼. `LAW_REFS.finalReturnAggregation` 인용. xlsx 시트 19 검증 영역 — TC-S05·S06·S07에서 본 코드 발동 0건 (모든 시나리오 2호 채택) |
| `FINAL_RETURN_DAN_SEO_APPLIED` | `finalReturnMethod === "CLAUSE_2_PER_TRANSFER_WITH_DAN_SEO"` + 단서 발동 (동일 호 세율 자산 ≥ 2 합산) | info | 동일 세율 자산 합산 단서 적용. MAX(합산, 단독) 채택. `LAW_REFS.finalReturnAggregation` 인용. xlsx 시트 19 검증 영역 — TC-S05·S06·S07에서 본 코드 발동 다수 |

#### 6-B-2. v0.3-B 활성 카탈로그 합계

`v0.3-A 활성 25종 + v0.3-B 신규 2종 = 활성 27종`

| 카테고리 | v0.2.1 | v0.3-A 변동 | v0.3-A 합계 | v0.3-B 변동 | **v0.3-B 합계** |
|---|---|---|---|---|---|
| v0.1 계승 | 10 | 0 | 10 | 0 | **10** |
| v0.2.1 신규 | 8 | 0 | 8 | 0 | **8** |
| v0.3-A 신규 (중과 핵심) | — | +5 | 5 | 0 | **5** |
| v0.3-A 보조 | — | +3 | 3 | 0 | **3** |
| v0.3-A 폐기 | — | −1 | −1 | 0 | **−1** |
| **v0.3-B 신규 (확정신고 v3)** | — | — | — | **+2** | **2** |
| **합계** | **18** | **+7 (순증)** | **25** | **+2 (순증)** | **27** |

#### 6-B-3. 발동 조건 상호 배타성

`FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED`와 `FINAL_RETURN_DAN_SEO_APPLIED`는 **상호 배타**:

| 시나리오 영역 | 발동 코드 |
|---|---|
| 단일 양도 (length === 1) | 0건 (`finalReturnMethod === "SINGLE_TRANSFER"`) — TC-001~014 회귀 안전성 영역 |
| 다중 양도 + 1호 채택 | `FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` 1건 |
| 다중 양도 + 2호 채택 + 단서 미발동 | 0건 |
| 다중 양도 + 2호 채택 + 단서 발동 | `FINAL_RETURN_DAN_SEO_APPLIED` 1건 |

> **단서 발동 조건**: `calculateClause2PerTransferWithDanSeo` 함수의 `byHeavyAddition` 그룹 중 1개 이상의 그룹이 `length >= 2` (동일 호 세율 자산 ≥ 2). 그룹별 MAX(합산 결과, 단독 합계) 채택 시 본 코드 발동.

#### 6-B-4. v0.3-A 회귀 안전성 (단일 양도 입력 시 발동 0건)

TC-001~014 14건은 모두 단일 양도 입력 → `finalReturnMethod === "SINGLE_TRANSFER"` → 본 신규 2종 발동 0건. 회귀 영향 0건.

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
| **v0.3-A** | **2026-05-02** | **작업 창 #11 산출.** (1) 노출 멤버 1종 신규: `isHeavyTaxationApplicable(caseData, intermediates)`. v0.2.1 20종 + 1 = 21종. (2) 단계 4 변경: 다주택 중과 발동 시 `longTermDeduction = 0` 강제 (제95조 ② 단서). 함수 시그니처에 `intermediates` 인자 추가. 출력 필드 2종 추가(`isHeavyTaxation`·`heavyRateAddition`). (3) 단계 9 변경: 중과 적용 + 보유 ≥ 2년 → 누진 구간 누적 세액 동적 재계산. 중과 적용 + 보유 < 2년 → max 비교 (제104조 ⑦ 본문 단서). 출력 필드 2종 추가(`shortTermTax`·`heavyProgressiveTax`). (4) `result.steps`에 v0.3-A 신규 필드 4종 추가 (총 27종). (5) `tax_rules.js` 의존 19종 (v0.2.1 17종 + v0.3-A 신규 2종 — 정본 명칭 기준). 별칭 4종(`EXEMPTION_*_THRESHOLD_*` 등) 영구 제거(인계 2). (6) 부트스트랩 가드 2-A 추가 (`HEAVY_TAX_RATE_ADDITION`·`findHeavyTaxRateAddition` 미로드 차단). (7) issueFlag 카탈로그 25종 (v0.2.1 18 + 신규 5 + 보조 3 − 폐기 1). (8) v0.1·v0.2 회귀 안전성 보존 (TC-001~010 모두 그대로 회귀 통과). (9) **TC-011~014 검증 통과 (5/2 KPI 100%)**. |
| **v0.3-B** | **2026-05-05** | **본 버전. 작업 창 #15 산출.** v0.3-A 모듈 스펙 (733줄) 베이스 + v0.3-B 신규 영역 통합. **순수 추가 패치 (addition-only)** — v0.3-A 21종 노출 멤버 시그니처·반환 형식 변경 0건. 13단계 단일 양도 파이프라인 본문 변경 0건. (1) 제목·메타데이터 표 v0.3-B 갱신 (의사결정 #13 인용 추가). (2) §0 변경 요약 v0.3-B 영역 신설 (v0.3-A → v0.3-B 변경 영역 일람 + 회귀 안전성 영역). (3) §0-A v0.2.1 → v0.3-A 변경 요약 본문 인용으로 보존 (회귀 안전성 정본). (4) §0-3 v0.3-B 인계 영역 추가 (시나리오 엔진 + 본질 가치 4영역). (5) §2 노출 멤버 21종 → **23종** (`findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount` 공개 노출 신규 2종 — 사용자 결정 옵션 (A) 채택). (6) §4-2-2-B `result.steps` 신규 4종 추가 (`saleYear`·`finalCalculatedTax`·`finalReturnMethod`·`finalReturnDiff`) → 27종 → **31종**. (7) §4-2-3 `terminateAt2=true` 시 v0.3-B 신규 4종 정책 영속화. (8) **§5-7 신규 §섹션 — 확정신고 v3 산식 5단계 본문 영속화** (사용자 결정 옵션 (A) 채택, 명세서 v0.3-B §5-7-3 단일 진본 인용): §5-7-1 §섹션 영역 + §5-7-2 법령 본문 (법 제104조 ⑤) + §5-7-3 5단계 산식 (`groupByTaxYear` + `calculateClause1AggregateProgressive` + `calculateClause2PerTransferWithDanSeo` + `applyFinalReturnV3` + `distributeFinalTaxByShare`) + §5-7-4 호출 위치 (시나리오 엔진 측 인계) + §5-7-5 v0.3-A 회귀 안전성 산식 증명 (단일 양도 입력 시 `SINGLE_TRANSFER` 분기) + §5-7-6 v0.3-B 신규 검증 영역 (TC-S05·S06·S07 정답값 xlsx 시트 19 직접 인용) + §5-7-7 issueFlag 신규 2종. (9) §5-8 (구 §5-7) 단계 11·12·13 §섹션 명명 이동. (10) §6-B issueFlag 카탈로그 25종 → **27종** (`FINAL_RETURN_AGGREGATE_PROGRESSIVE_APPLIED` + `FINAL_RETURN_DAN_SEO_APPLIED` 신규 2종, 발동 조건 상호 배타). (11) `ENGINE_VERSION` `"v0.3.0-A"` → `"v0.3.0-B"`. (12) **5/4 합의 결정 5건 모두 채택** — 결정 1 (`getRateGroupKey` 정수 키 — B-022 부동소수점 회피), 결정 2 (clause2 단서 산식 v0.3-A 누적 baseTax 그대로), 결정 3 (`applyFinalReturnV3` `length === 1` → `SINGLE_TRANSFER` 분기 — 회귀 안전성), 결정 4 (issueFlag 신규 2종), 결정 5 (`ENGINE_VERSION` "v0.3.0-B" 채택). (13) 의사결정 #13 (확정신고 v3 산식 — 법 제104조 ⑤ 정확본) 본문 직접 인용 + 의사결정 #11 (정확성 > 속도) 시간 제약 표기 없음. (14) **사용자 39번째 짚음 정정 영역**: 시행령 제167조의10은 다주택 중과 자산 정의 조문일 뿐 — `LAW_REFS.finalReturnAggregation` 영역에서 시행령 제167조의10 인용 0건. (15) **인계 처리**: B-022 (정수 처리 — `getRateGroupKey` 영역에서 부동소수점 회피용), B-024 (일시적 2주택 — post-MVP), B-028~B-031 (본질 가치 4영역 — post-MVP), B-032 (결과 객체 구조 — v0.3-B 범위 외, v0.2.1·v0.3-A 그대로 계승), B-033 (자동 조정대상지역 판정). **(16) v0.3-A → v0.3-B 패치 라인 추정 약 +250~+350 라인** (확정신고 v3 산식 5단계 본문 + 누진 산출 헬퍼 공개 노출 + `result.steps` 4종 + issueFlag 2종 + `ENGINE_VERSION` 1라인). |

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

## 부록 A. 자체 검증 결과 (v0.3-A 모듈 스펙 — 본문 그대로 보존)

본 부록 A는 v0.3-A 모듈 스펙 산출 직후 작업 창 #11이 수행한 자체 검증 5건 결과. v0.3-B 합본에서도 본 부록 A 본문은 그대로 보존된다 (v0.3-A 회귀 안전성 정본).

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

## 부록 B. 자체 검증 결과 (v0.3-B 모듈 스펙 — 작업 창 #15 신규)

본 부록 B는 v0.3-B 모듈 스펙 산출 직후 작업 창 #15가 수행한 자체 검증 5건 결과.

### B-1. 백로그 정합성 (v0.3-B 신규 인계 영역 정독 후 매핑)

| 백로그 ID | 본 모듈 스펙 v0.3-B 인용 위치 | 정합성 |
|---|---|---|
| **B-022** (정수 처리 — 절사 vs 반올림) | §5-7-3 3단계 `getRateGroupKey` 정수 키 (Math.round 패턴) | ✅ 5/4 합의 결정 1번 — 부동소수점 회피용. v0.3-A 절사 정책 그대로 보존 (Math.floor) |
| **B-024** (일시적 2주택) | §0-3 인계 영역 | ✅ post-MVP 인계 (명세서 §1-4 옵션 (나) 미포함 그대로) |
| **B-028~B-031** (본질 가치 4영역) | §0-3 인계 영역 | ✅ post-MVP 인계 (명세서 §1-2 정본) |
| **B-032** (결과 객체 구조) | §0-3 인계 영역 | ✅ v0.3-B 범위 외, v0.2.1·v0.3-A 패턴 그대로 계승. post-MVP 처리 |
| **B-033** (자동 조정대상지역 판정) | §0-3 인계 영역 | ✅ post-MVP, 본 v0.3-B 영향 없음 |

### B-2. 명세서 v0.3-B 인용 정합성 (§5-7·§9 정독 후 인용)

| 본 모듈 스펙 §X | 명세서 v0.3-B §Y 정독 후 인용 |
|---|---|
| §0 변경 요약 (v0.3-A → v0.3-B) | 명세서 §12-1 (변경 요약) + 의사결정 #13 본문 |
| §2 신규 노출 2종 (`findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount`) | 명세서 §5-7-3 2·3단계 본문 — 호출 의존 |
| §4-2-2-B 신규 4종 필드 | 명세서 §5-7-3 1·4·5단계 본문 — `saleYear` (1단계 그룹화 키) + `finalCalculatedTax` (5단계 분배 결과) + `finalReturnMethod` (4단계 selection) + `finalReturnDiff` (4단계 차이) |
| §5-7 5단계 산식 본문 | 명세서 §5-7-3 1·2·3·4·5단계 본문 직접 인용 |
| §5-7-2 법령 본문 | 명세서 §5-7-2 법 제104조 ⑤ 정확본 인용 그대로 |
| §5-7-4 호출 위치 (시나리오 엔진 측 인계) | 명세서 §5-7-4 본문 + 사용자 결정 옵션 (A) 본문 영속화 |
| §5-7-5 회귀 안전성 산식 증명 | 명세서 §5-7-5 본문 + 의사결정 #13 회귀 안전성 영역 |
| §5-7-6 v0.3-B 신규 검증 영역 | xlsx 시트 19 (산식정정_v3) 본문 직접 인용 |
| §6-B issueFlag 신규 2종 | 명세서 §5-7-6 + §9-2 표 12·13번째 행 본문 |

### B-3. v0.3-A 회귀 안전성 검증 (TC-001~014 14건 보존 — 절대 깨지면 안 됨)

| 항목 | 검증 결과 |
|---|---|
| v0.3-A 21종 노출 멤버 시그니처·반환 형식 보존 | ✅ §2 표 명시 (`ENGINE_VERSION` 1라인 갱신만 예외) |
| 13단계 단일 양도 파이프라인 본문 변경 0건 | ✅ §0-1 표 명시 — 양도 1건당 산식은 v0.3-A 그대로 |
| `result.steps` 27종 그대로 보존 + v0.3-B 신규 4종 추가 | ✅ §4-2-2-B 영속화 |
| issueFlag 25종 그대로 보존 + v0.3-B 신규 2종 추가 | ✅ §6-B-2 카탈로그 표 27종 검산 통과 |
| 단일 양도 입력 시 `applyFinalReturnV3` `length === 1` → `SINGLE_TRANSFER` 분기 | ✅ §5-7-5 산식 증명 영속화 |
| `finalCalculatedTax = calculatedTax` 그대로 (단일 양도 분기) | ✅ §5-7-3 5단계 `distributeFinalTaxByShare` 함수 본문 영속화 |
| TC-001~014 14건 totalTax 100% 일치 | ✅ §5-7-5 산식 증명 + 의사결정 #13 회귀 안전성 영역 |

### B-4. v0.3-B 신규 영역 검증

| 명세서 §X / 본 모듈 §Y 검증 항목 | 본 모듈 스펙 매핑 |
|---|---|
| §5-7-3 1단계 `groupByTaxYear` | §5-7-3 1단계 함수 계약 + 의사코드 |
| §5-7-3 2단계 `calculateClause1AggregateProgressive` (1호 합산 누진) | §5-7-3 2단계 함수 계약 + 의사코드 + 가산세율 미적용 사유 |
| §5-7-3 3단계 `calculateClause2PerTransferWithDanSeo` (2호 단독 + 단서) | §5-7-3 3단계 함수 계약 + 의사코드 + `getRateGroupKey` 정수 키 헬퍼 + 5/4 합의 결정 1·2번 본문 |
| §5-7-3 4단계 `applyFinalReturnV3` (MAX selection) | §5-7-3 4단계 함수 계약 + 의사코드 + 5/4 합의 결정 3번 본문 (`length === 1` 분기) |
| §5-7-3 5단계 `distributeFinalTaxByShare` (양도별 비례 분배) | §5-7-3 5단계 함수 계약 + 의사코드 + 부수효과 영역 + Math.floor 정책 |
| §5-7-4 호출 위치 | §5-7-4 의사코드 + 호출 측 책임 영역 인계 |
| §5-7-6 검증 영역 (TC-S05·S06·S07) | §5-7-6 표 + xlsx 시트 19 본문 직접 인용 |
| issueFlag 신규 2종 | §6-B-1·§6-B-2·§6-B-3 |

### B-5. 자체 발견 짚을 부분 (3건)

본 모듈 스펙 v0.3-B 작성 중 발견한 짚을 부분 3건.

#### 짚을 부분 B-1: `findCalculatedTax` mutation 영역 — `result.steps` 불변성 약속 예외

- **현상**: §5-7-3 5단계 `distributeFinalTaxByShare`는 `result.steps.finalCalculatedTax` 필드를 mutation한다. 본 모듈 §7 불변성 약속 (v0.2.1 + v0.3-A) 영역에서는 `calculateSingleTransfer`가 결과 객체를 1회 생성 후 변경하지 않는 정책이었다.
- **본 모듈 스펙 처리**: §5-7-3 5단계 본문에 mutation 영역을 명시. 호출 측 (`scenario_engine.js`)은 본 mutation을 인지한 후 `localIncomeTax`·`totalTax`·`netAfterTaxSaleAmount`·`effectiveTaxRate` 재산출. 본 mutation은 v0.3-B 산식 5단계 처리 후 1회만 허용 (예외 영역).
- **후속 확인 필요**: §7 불변성 약속 §섹션에 v0.3-B 예외 영역 명시 추가 권고 (작업 창 #16 작업지시서 v0.3-B 진입 시점).

#### 짚을 부분 B-2: `findProgressiveTaxAmount` + `findHeavyProgressiveTaxAmount` 공개 노출의 v0.3-A 회귀 영향

- **현상**: 본 2종은 v0.3-A에서 단계 9 내부 함수로 동작했으나 노출되지 않았음. v0.3-B에서 §5-7 산식 5단계가 본 함수를 호출해야 하므로 공개 노출로 격상.
- **본 모듈 스펙 처리**: §2 본문에 공개 노출 격상 사유 명시. 시그니처·반환값 변동 0건이므로 v0.3-A 회귀 영향 0건.
- **후속 확인 필요**: Claude Code 산출 단계 (작업 창 #16) 진입 시 v0.3-A `tax_engine.js` 본문에서 본 2종 함수가 IIFE 외부에서 호출 가능한지 확인. 호출 가능하지 않으면 노출 격상 패치 영역 1건 추가 (v0.3-B 코드 변경 라인 +5~+10).

#### 짚을 부분 B-3: `finalCalculatedTax` 분배 후 합계 vs `finalReturnTax` 차이 (Math.floor 누적 손실)

- **현상**: §5-7-3 5단계 `distributeFinalTaxByShare`는 `Math.floor` 적용으로 분배 후 `Σ finalCalculatedTax`가 `finalReturnTax`보다 약간 작을 수 있음 (최대 N−1원, N = 양도 개수). xlsx 시트 19 검증 결과 — TC-S06 SC-3에서 −1원 차이 발생.
- **본 모듈 스펙 처리**: §5-7-3 5단계 본문에 분배 후 합계 vs 원본 합계 차이 영역 명시. 본 차이는 v3 산식 본문의 정합 영역 (Math.floor 정책 그대로). 호출 측은 본 차이를 issueFlag로 표시 미고려 (검증 영역).
- **후속 확인 필요**: post-MVP 단계에서 분배 정책 재검토 시 (예: 마지막 양도에 잔여 1원 보정) 본 영역 갱신 필요.

### B-6. 인용 자료 미비 — 없음

본 모듈 스펙 v0.3-B 작성 중 인용한 자료는 모두 프로젝트 지식에 영속화된 정본 (명세서 v0.3-B, v0.3-A 모듈 스펙, 의사결정 #13, 소득세법 PDF, xlsx 시트 14·17·19)이며 미비 항목 없음.

### B-7. 자체 sanity 검증

| 항목 | 결과 |
|---|---|
| §2 v0.3-B 노출 멤버 카운트 (v0.3-A 21종 + v0.3-B 2종 = 23종) | ✅ 23종 |
| §4-2-2-B v0.3-B 신규 4종 카운트 (`saleYear`·`finalCalculatedTax`·`finalReturnMethod`·`finalReturnDiff`) | ✅ 4종 |
| §5-7-3 산식 5단계 카운트 (`groupByTaxYear` + `calculateClause1AggregateProgressive` + `calculateClause2PerTransferWithDanSeo` + `applyFinalReturnV3` + `distributeFinalTaxByShare`) | ✅ 5단계 |
| §6-B-2 issueFlag 카탈로그 27종 검산 (10 + 8 + 5 + 3 − 1 + 2 = 27) | ✅ 27종 |
| `ENGINE_VERSION` 갱신값 (`"v0.3.0-B"`) | ✅ 의사결정 #13 영속화 그대로 |
| 강조어 "본격" 사용 횟수 (1답변 1~2회 한도) | ✅ v0.3-B 신규 영역 0회 (잔존은 v0.3-A 베이스 본문 그대로) |
| 시행령 제167조의10 인용 횟수 (`LAW_REFS.finalReturnAggregation` 영역 0건) | ✅ §5-7-2 본문 정정 영역에서 정정 명시. `LAW_REFS.heavyTaxation` 영역만 인용 (v0.3-A 본문 그대로 보존) |
| 추측 표기 횟수 | ✅ 0건 |
| 5/4 합의 결정 5건 채택 영속화 | ✅ §5-7-3 (결정 1·2·3) + §6-B (결정 4) + §10 (결정 5) |

### B-8. 차단 사항

본 모듈 스펙 v0.3-B 작성 완료. 차단 사항 0건.

후속 작업 창(#16 작업지시서 v0.3-B — `tax_rules.js` + `tax_engine.js` v0.3-B 패치) 진입 가능 상태. 산식 5단계 본문은 본 §5-7 단일 진본을 그대로 코드로 옮긴다.

---

본 문서는 v0.3-B 명세서가 변경되지 않는 한 함께 변경되지 않는다. post-MVP 단계에서 본질 가치 4영역(B-028~B-031) 도입 또는 시나리오 엔진 (`scenario_engine.md` v0.3-B 신규 작성) 진입 시 별도 갱신.

(끝)
