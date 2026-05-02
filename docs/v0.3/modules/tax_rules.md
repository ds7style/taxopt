# tax_rules.js 모듈 스펙 v0.3-A

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.3/modules/tax_rules.md` |
| 버전 | v0.3-A (다주택 중과 가산세율 룩업 활성, 시나리오 엔진 미포함) |
| 상태 | 작성 완료 (2026-05-02, 작업 창 #11) |
| 작성 출처 | 작업 창 #11 (v0.3-A 모듈 스펙 — tax_rules.md + tax_engine.md 통합 갱신) |
| 대상 코드 | `js/tax_rules.js` (v0.2.0 → v0.3-A 패치 대상, 본 모듈 스펙은 .js 본문 산출 금지 — 의사결정 #9 v9) |
| 대상 테스트 | `tests/tax_rules.test.js` (v0.2.0 → v0.3-A 패치 대상) |
| 관련 작업지시서 | `docs/05_code_work_orders/05_tax_rules_v0_3_a.md` (작업 창 #12 산출 예정) |
| 관련 명세서 | `docs/v0.3/01_calc_engine_spec.md` v0.3-A (✅ 검증 통과, KPI 100%, 2026-05-02) |
| 호출 측 모듈 스펙 | `docs/v0.3/modules/tax_engine.md` v0.3-A (단계 4·9 변경 + 가산세율 룩업 호출 — 본 작업 창 동시 산출) |
| 관련 골든셋 | `docs/v0.3/06_test_cases.md` v0.3-A (TC-006~010 v0.2 회귀 + TC-011~014 v0.3-A 신규, 검증 후 갱신 예정) |
| 이전 버전 | v0.2.0 (`docs/v0.2/modules/tax_rules.md`, 5/2 KPI 100% 검증 통과) |
| 다음 버전 | v0.3-B (시나리오 엔진 도입), post-MVP (시행령 제167조의10·11 단서·자동 조정대상지역 판정) |
| 관련 의사결정 | `docs/99_decision_log.md` #1 (중과 유예 처리), #5 강화 (법령 개정 대응 아키텍처 — §0-1), #6 (영속화 의무), #9 v9 (.js 본문 산출 금지), #11 (정확성 > 속도), #12 (모듈 스펙 v0.3-A 정본화) |
| 관련 백로그 | B-018 (5/7 발표 PT 보조 슬라이드), B-020 (의사결정 #5 강화 — 명세서 §0-1 본 모듈 적용), B-021 (법제처 OpenAPI 활용 검토 — §7 시행일별 다중 규칙 패턴 인계), B-022 (양도소득세 정수 처리 — v0.3-A 무영향), B-023 (양도소득세 부칙·경과규정 본격 반영 — §11-6 TR-08 인계 + 강남3구·용산 한시 유예 미처리), B-024 (일시적 2주택 — v0.3-A 미포함 결정), B-032 (결과 객체 구조 — v0.3-A 범위 외, 호출 측 tax_engine.md v0.3-A 책임), B-033 (자동 조정대상지역 판정 — post-MVP 인계, B-021 통합) |

---

## 0. 변경 요약 (v0.2.0 → v0.3-A)

본 모듈 스펙 v0.3-A는 **v0.2.0 본문 §1~§14를 모두 그대로 계승**하면서, **다주택 중과 가산세율 룩업** 영역만 신규 추가한다. v0.2.0의 24종 노출 멤버 시그니처·값은 모두 그대로 보존되며, v0.1 회귀 67건 + v0.2 회귀 83건(추정, baseline 150건) 모두 그대로 통과해야 한다.

### 0-1. v0.3-A 신규 영역 일람 (명세서 v0.3-A §0·§3·§9 인용)

| 영역 | v0.2.0 동작 | v0.3-A 동작 | 본 모듈 스펙 §X |
|---|---|---|---|
| 노출 멤버 합계 | 24종 (v0.1 17 + v0.2 신규 7) | **26종** (v0.2 24 + v0.3-A 신규 2) | §1-3, §2-2 |
| 신규 룩업 테이블 | — | **`HEAVY_TAX_RATE_ADDITION`** (2주택 +20%p / 3주택 +30%p, 2행) | §3-A |
| 신규 헬퍼 함수 | — | **`findHeavyTaxRateAddition(houseCount)`** (클램프 동작: 3주택+ → 0.30) | §4-A |
| `LAW_REFS` | 10종 (v0.1 6 + v0.2 4) | + **`heavyTaxation`** (1키 추가, 멤버 수 카운트 미포함) | §3-6-2-A |
| `selfTest()` | 6종 검증 (continuity·integers·monotonic·longTermLookups + 메타 2종) | + **`verifyHeavyTaxRateAddition()`** (sanity 8건으로 확장) | §9-A |
| `RULE_VERSION` | `"v0.2.0-post-20260510"` | **`"v0.3.0-post-20260510"`** (Claude Code 결정 권장) | §3-6-1-A |

> **인터페이스 약속**: v0.2.0의 24종 노출 멤버는 모두 시그니처·값·반환 형식 그대로 유지. v0.3-A 패치는 **순수 추가**(addition-only)이며 v0.2 또는 v0.1 회귀를 깨지 않는다.

### 0-2. 본 모듈 스펙이 처리하지 않는 영역 (호출 측 모듈 스펙 위임)

| 영역 | 처리 모듈 스펙 |
|---|---|
| 단계 4 변경 (중과 시 `longTermDeduction = 0`, 제95조 ② 단서) | `tax_engine.md` v0.3-A §5-A |
| 단계 9 변경 (중과 시 누진세율 + 가산세율 동적 재계산) | `tax_engine.md` v0.3-A §5-A |
| 보유 < 2년 + 중과 max 비교 (제104조 ⑦ 본문 단서) | `tax_engine.md` v0.3-A §5-A |
| `isHeavyTaxationApplicable(caseData, intermediates)` 4단계 조건 평가 | `tax_engine.md` v0.3-A §5-5 |
| 결과 객체 신규 필드 4종 (`isHeavyTaxation`·`heavyRateAddition`·`shortTermTax`·`heavyProgressiveTax`) | `tax_engine.md` v0.3-A §4-A |
| issueFlag 카탈로g v0.3-A 25종 (신규 5 + 보조 3 − 폐기 1) | `tax_engine.md` v0.3-A §6-A |
| 부트스트랩 가드 v0.3-A (HEAVY_TAX_RATE_ADDITION·findHeavyTaxRateAddition 미로드 차단) | `tax_engine.md` v0.3-A §8-2-2 |

> 본 모듈은 **법령 명시 숫자·표·임계의 단일 보유자**이며, 산식 흐름·결과 객체 구조·issueFlag 발동 조건은 모두 호출 측 `tax_engine.js` 책임 (§0-1 원칙 (3) 산식 흐름 분리).

---

## 1. 개요

### 1-1. 목적

본 문서는 `js/tax_rules.js` v0.3-A의 **계약 문서**다. 호출하는 측(`tax_engine.js` v0.3-A 등)이 본 모듈을 어떻게 사용해야 하는지, 본 모듈이 무엇을 보장하는지를 정의한다.

코드 본문(`js/tax_rules.js`)과 본 문서가 충돌하면 **본 문서를 우선**한다. 코드 본문이 본 문서와 다르면 코드를 수정한다. 본 문서를 변경해야 하는 경우는 v0.3-A 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신한다.

### 1-2. §0-1 법령 개정 대응 아키텍처 인용 (의사결정 #5 강화 + v0.3-A §0-1-2 옵션 (가) 채택)

본 모듈은 명세서 v0.3-A §0-1이 정의한 **법령 개정 대응 아키텍처의 단일 소스 모듈**이다. v0.3-A는 v0.2.1의 3원칙을 그대로 계승하면서, **다주택 중과 가산세율(+20%p, +30%p)도 동일 원칙을 적용**한다.

| 원칙 | 본 모듈에서의 의미 (v0.2.0 그대로) | v0.3-A 적용 |
|---|---|---|
| (1) **단일 소스** | 법령 명시 숫자(임계 금액·세율·공제율 표·연차 분기 임계)는 모두 본 모듈 한 곳에만 둔다. `tax_engine.js`·`scenario_engine.js`·`input_collector.js` 어느 다른 모듈도 법령 숫자를 직접 보유하지 않는다. | 다주택 중과 가산세율(+20%p / +30%p)은 본 모듈에 **`HEAVY_TAX_RATE_ADDITION` 룩업 테이블**로 단일 보유. 호출 측은 **`findHeavyTaxRateAddition(houseCount)`** 함수 호출로만 가산세율 획득. |
| (2) **룩업 테이블 우선** | 법령 표(누진세율표·장특공 표 1·표 2)는 표 그대로 룩업 테이블 형태로 정의한다. `0.06 + (n−3) × 0.02` 같은 등차수열 산식이 표와 결과가 동치이더라도 산식 형태는 금지한다. | `HEAVY_TAX_RATE_ADDITION = [{ houseCount: 2, addition: 0.20 }, { houseCount: 3, addition: 0.30 }]` 형태의 2행 룩업. 등차수열 산식(`(houseCount−1) × 0.10`) **금지**. |
| (3) **산식 흐름 분리** | 본 모듈은 데이터·룩업 함수만 노출한다. 13단계 산식 흐름·절사·합계는 `tax_engine.js`가 담당한다. | 단계 9 중과 적용 시 누진 구간 누적 세액 재계산은 **`tax_engine.js` 책임**. 본 모듈은 가산세율 1개만 룩업으로 제공. 중과 누진세율표 별도 보유는 **금지**. |

#### 1-2-1. 옵션 (가) 채택 근거 — 명세서 v0.3-A §0-1-2 인용 (인계 3 처리)

명세서 v0.3-A §0-1-2는 다음 두 옵션을 비교 검토한 후 옵션 (가)를 채택했다. 본 모듈 스펙도 동일 채택을 따른다.

| 옵션 | 장점 | 단점 | 본 모듈 채택 |
|---|---|---|---|
| (가) `HEAVY_TAX_RATE_ADDITION` 룩업 + `tax_engine.js` 동적 재계산 | 단일 소스 (가산세율 1개 룩업), 향후 가산세율 변경 시 룩업만 갱신 | 단계 9에 재계산 흐름 추가 (`tax_engine.js` 흐름 증가) | **✅ 채택** |
| (나) `PROGRESSIVE_BRACKETS_HEAVY_2HOUSE`·`_3HOUSE` 별도 누진세율표 보유 | 단계 9에 재계산 흐름 없음 (`findBracket`만 호출) | 룩업 테이블 3개로 증가, 누진세율표 변경 시 3개 모두 갱신 필요 | 비채택 |

**채택 근거 (명세서 §0-1-2 본문 인용)**: 법령 본문(소득세법 제104조 ⑦)이 "세율에 100분의 20(또는 30)을 더한 세율을 적용한다"로 명시. 별도의 중과 누진세율표를 표로 제시하지 않음. 시행령에도 별도 표 없음. 따라서 룩업 테이블 우선 원칙(2)에 충실하려면 **가산세율만 룩업으로 보유**하고 누진 구간 적용은 `tax_engine.js`의 산식 흐름으로 처리.

#### 1-2-2. 후속 재검토 사항 (v0.5+ 인계, §11-6 TR-09 신규)

v0.5+ 단계에서 다른 중과 케이스(예: 비사업용 토지 중과 +10%p, 분양권 중과 등) 추가 시 본 결정의 일관성을 재검토한다 (명세서 §15-5 짚을 부분 1). 옵션 (가)의 동적 재계산 흐름이 다중 가산세율 케이스에서도 유지 가능한지, 또는 옵션 (나)의 별도 테이블 보유가 더 적합한지 별도 논의.

법령 개정 시 수정 범위를 본 모듈 한 곳으로 한정하여 회귀 위험을 차단하고, 향후 법제처 OpenAPI 자동 갱신(B-021) 시 자동화 대상을 본 모듈로 한정한다.

### 1-3. v0.2.0 → v0.3-A 변경 요약

| 영역 | v0.2.0 | v0.3-A |
|---|---|---|
| 노출 멤버 | 24종 | **26종** (v0.2 24종 + v0.3-A 신규 2종) |
| 신규 노출 — 룩업 테이블 | — | **`HEAVY_TAX_RATE_ADDITION`** (2행, 2주택·3주택 가산세율) |
| 신규 노출 — 룩업 함수 | — | **`findHeavyTaxRateAddition(houseCount)`** (클램프: 3주택+ → 0.30) |
| `LAW_REFS` | 10종 (v0.1 6 + v0.2 4) | + **`heavyTaxation`** 1키 (`"소득세법 제104조 제7항, 시행령 제167조의3·제167조의10·제167조의11"`) |
| `selfTest()` | 6종 검증 | + **`verifyHeavyTaxRateAddition()`** (가산세율 룩업 sanity) — 7종 검증 |
| `RULE_VERSION` | `"v0.2.0-post-20260510"` | **`"v0.3.0-post-20260510"`** |
| `Object.freeze` | 미적용 (v0.2 정책 계승) | **미적용** (v0.3-A 정책 계승, §11-3 결정 그대로) |
| selfTest sanity 케이스 | 6건 (TC-001/003/005 + TC-006/008/010, longTermLookups 15건 통합) | + **TC-011·012 룩업 결과 sanity 2건** (총 8건) — 명세서 §10-2-1·§10-2-2 회귀 보호 |

> v0.2 노출 멤버 24종은 **모두 시그니처·값·반환 형식 그대로 유지**한다. v0.3-A 패치는 **신규 추가만**(addition-only)이며 v0.2 회귀 + v0.1 회귀를 모두 깨지 않는다. 단 `RULE_VERSION` 문자열만 갱신한다.

> `LAW_REFS` 키 추가는 **노출 멤버 수 증가에 포함하지 않는다** (명세서 v0.3-A §9-2 정본). v0.1.1에서도 `LAW_REFS` 객체는 1종으로 카운트한 정책을 v0.3-A도 그대로 따른다.

### 1-4. 의존성 (요약, v0.2.0 그대로)

| 종류 | 내용 |
|---|---|
| 외부 라이브러리 | 없음 |
| 다른 TaxOpt 모듈 | 없음 (베이스 모듈) |
| DOM | 사용 없음 |
| 전역 부수효과 | `window.TaxOpt.taxRules` 등록만 |

상세는 §8 참조.

---

## 2. 노출 인터페이스

### 2-1. 노출 객체

```js
window.TaxOpt.taxRules
```

ES6 module(`import`/`export`)을 사용하지 않는다 (의사결정 #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화한다. `window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback한다 (v0.1·v0.2와 동일).

### 2-2. 노출 멤버 일람 (v0.1 계승 17종 + v0.2 신규 7종 + v0.3-A 신규 2종 = 26종)

> v0.3-A 신규는 **굵게 + (v0.3-A)** 표기. v0.2 신규는 **굵게**.

#### 2-2-1. 메타데이터 (3종, v0.1 계승)

| 멤버 | 타입 | 역할 | v0.3-A 변경 |
|---|---|---|---|
| `RULE_VERSION` | string | 결과 객체에 기록할 규칙 버전 식별자 | **`"v0.3.0-post-20260510"`로 갱신** |
| `APPLICABLE_SALE_DATE_FROM` | string (ISO date) | 본 규칙이 적용되는 양도일 하한 | 동일 (`"2026-05-10"`) |
| `LAW_REFS` | object | 적용 법령 라벨 (v0.2 10종 + **v0.3-A 신규 1종 = 11종**) | 키 1종 추가 (`heavyTaxation`) |

#### 2-2-2. 금액·세율·임계 상수 (8종, v0.2.0 계승)

| 멤버 | 타입 | 값 | v0.3-A 변경 |
|---|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | number (정수) | 2,500,000 | 동일 |
| `LOCAL_INCOME_TAX_RATE` | number | 0.1 | 동일 |
| `SHORT_TERM_RATE_UNDER_1Y` | number | 0.7 | 동일 |
| `SHORT_TERM_RATE_UNDER_2Y` | number | 0.6 | 동일 |
| `UNREGISTERED_RATE` | number | 0.7 | 동일 |
| `HIGH_VALUE_HOUSE_THRESHOLD` | number (정수) | 1,200,000,000 | 동일 |
| `NON_TAXABLE_HOLDING_MIN_YEARS` | number (정수) | 2 | 동일 |
| `NON_TAXABLE_RESIDENCE_MIN_YEARS` | number (정수) | 2 | 동일 |

> **인계 2 (정본 명칭) 그대로 적용**: v0.2.0의 정본 명칭 `NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS` 그대로 사용. 별칭(`EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`)은 v0.3-A에서도 **사용 금지**. 호출 측 `tax_engine.md` v0.3-A는 본 정본 명칭만 인용한다 (호출 측 §8-1 별칭 영구 제거).

#### 2-2-3. 룩업 테이블 (5종, v0.2 4종 + v0.3-A 신규 1종)

| 멤버 | 타입 | 행 수 | v0.3-A 변경 |
|---|---|---|---|
| `PROGRESSIVE_BRACKETS` | object[] | 8 | 동일 |
| `LONG_TERM_DEDUCTION_TABLE_1` | object[] | 13 | 동일 |
| `LONG_TERM_DEDUCTION_TABLE_2_HOLDING` | object[] | 8 | 동일 |
| `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` | object[] | 9 | 동일 |
| **`HEAVY_TAX_RATE_ADDITION`** (v0.3-A) | object[] | **2** | **신규 — 다주택 중과 가산세율 룩업** |

#### 2-2-4. 임계 배열 (1종, v0.2.0 계승)

| 멤버 | 타입 | 값 | v0.3-A 변경 |
|---|---|---|---|
| `HOLDING_PERIOD_BOUNDARY_YEARS` | number[] | `[1, 2, 3, 15]` | 동일 (§11-4 결정 그대로) |

> **v0.3-A 보유 임계 추가 검토 — 결정**: 다주택 중과 판정에서 보유 < 2년 분기는 단계 8의 기존 `under1y`/`under2y`/`over2y` 분기와 동일한 임계(2년)를 사용한다. 따라서 `HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]` 그대로 유지하며 v0.3-A 신규 임계 추가 없음 (§11-4-A).

#### 2-2-5. 헬퍼 함수 (4종, v0.2 3종 + v0.3-A 신규 1종)

| 멤버 | 타입 | v0.3-A 변경 |
|---|---|---|
| `findBracket(taxBase)` | function | 동일 |
| `findHoldingRate(holdingYears, table)` | function | 동일 |
| `findResidenceRate(residenceYears, holdingYears, table)` | function | 동일 |
| **`findHeavyTaxRateAddition(houseCount)`** (v0.3-A) | function | **신규 — 다주택 중과 가산세율 룩업** |

#### 2-2-6. 자체검증 함수 (6종, v0.2 5종 + v0.3-A 신규 1종)

| 멤버 | 타입 | v0.3-A 변경 |
|---|---|---|
| `selfTest()` | function | 본문 보강 (heavyTaxAdditionLookups 필드 추가, sanity 8건) |
| `verifyProgressiveContinuity()` | function | 동일 |
| `verifyBaseTaxAreIntegers()` | function | 동일 |
| `verifyMonotonic()` | function | 동일 |
| `verifyLongTermLookups()` | function | 동일 |
| **`verifyHeavyTaxRateAddition()`** (v0.3-A) | function | **신규 — 가산세율 룩업 sanity 통합 검증** |

#### 2-2-7. v0.3-A 노출 멤버 합계 정합성 검산

| 카테고리 | v0.1 | v0.2 신규 | v0.3-A 신규 | v0.3-A 합계 |
|---|---|---|---|---|
| 메타데이터 | 3 | 0 | 0 | 3 |
| 금액·세율·임계 상수 | 5 | 3 | 0 | 8 |
| 룩업 테이블 | 1 | 3 | **1** | 5 |
| 임계 배열 | 0 | 1 | 0 | 1 |
| 헬퍼 함수 | 1 | 2 | **1** | 4 |
| 자체검증 함수 | 4 | 1 | **1** (verifyHeavyTaxRateAddition) | 6 (selfTest 1 + 보조 5) |
| **합계** | **17** | **7** | **2 (HEAVY_TAX_RATE_ADDITION + findHeavyTaxRateAddition)** | **26** |

> **인계 5 (멤버 수 정확 표기) 처리**: v0.1 17종 + v0.2 신규 7종 = 24종 + v0.3-A 신규 2종 = **26종**. 시스템 프롬프트의 "v0.1 13종" 표기는 v0.1.1 모듈 스펙 §2-2 + 작업지시서 03 §3-1 + 작업지시서 04 §3-4 정본 "v0.1 17종"과 충돌하므로 **v0.1 17종 정본 채택**. 본 모듈 스펙은 v0.3-A 26종 정본을 따른다.

> **헬퍼 vs 자체검증 카운팅 주의**: §1-3 변경 요약 표는 "v0.3-A 신규 2종 = `HEAVY_TAX_RATE_ADDITION` + `findHeavyTaxRateAddition`"으로 카운트하며 `verifyHeavyTaxRateAddition`은 자체검증 카테고리 내부 분화로 처리(v0.2.0 §2-2와 동일 패턴 — `verifyLongTermLookups`도 v0.2 신규였으나 §1-3에서 "신규 7종" 카운트에 별도로 산입). 본 모듈 스펙은 명세서 v0.3-A §9-2 정본 ("v0.3-A 추가 2종")을 따른다. `verifyHeavyTaxRateAddition`은 자체검증 함수 카테고리 내 부속 함수로 카운트되므로 노출 멤버 카운트에는 영향이 없다.

---

## 3. 데이터 정의

### 3-1. PROGRESSIVE_BRACKETS (v0.1 계승, v0.2·v0.3-A 변경 없음)

v0.1.1 §4 그대로. 8개 원소, 누진 연속성·정수성·단조성 모두 v0.1 selfTest로 보장. **v0.2·v0.3-A에서 변경 없음**.

원소 스키마:

```js
{
  idx:          number,    // 1~8
  lowerBound:   number,    // 정수, 이전 구간 upperBound와 동일
  upperBound:   number,    // 정수 또는 Infinity (8구간만)
  marginalRate: number,    // 0~1
  baseTax:      number,    // 정수, lowerBound까지 누적 산출세액
  label:        string     // UI 표시용
}
```

8개 원소 정답값(`v0.1.1` §4-2)은 변경 없음. `findBracket(taxBase)` 계약도 v0.1.1 §5 그대로.

> **§0-1 원칙 (2)·(3) 적용**: 본 표는 산식이 아닌 룩업 테이블로 보유되며, 호출 측은 `findBracket` 함수로만 접근. v0.1부터 이 패턴 적용.

> **v0.3-A 활용 보강**: 단계 9에서 다주택 중과 발동 시 호출 측 `tax_engine.js`는 `findBracket(taxBase)`로 기본 누진 구간을 획득한 뒤, `findHeavyTaxRateAddition(houseCount)`로 가산세율을 받아 동적 재계산한다 (§3-A-3 참조). 본 표 자체는 변경되지 않는다.

### 3-2. LONG_TERM_DEDUCTION_TABLE_1 (v0.2 계승, v0.3-A 변경 없음)

v0.2.0 §3-2 그대로. 13행, 시행령 제95조 ② 표 1 본문. **v0.3-A에서 변경 없음**.

| idx | lowerBound | upperBound | rate | label |
|---|---|---|---|---|
| 1 | 3 | 4 | 0.06 | "3년 이상 4년 미만" |
| 2 | 4 | 5 | 0.08 | "4년 이상 5년 미만" |
| 3 | 5 | 6 | 0.10 | "5년 이상 6년 미만" |
| 4 | 6 | 7 | 0.12 | "6년 이상 7년 미만" |
| 5 | 7 | 8 | 0.14 | "7년 이상 8년 미만" |
| 6 | 8 | 9 | 0.16 | "8년 이상 9년 미만" |
| 7 | 9 | 10 | 0.18 | "9년 이상 10년 미만" |
| 8 | 10 | 11 | 0.20 | "10년 이상 11년 미만" |
| 9 | 11 | 12 | 0.22 | "11년 이상 12년 미만" |
| 10 | 12 | 13 | 0.24 | "12년 이상 13년 미만" |
| 11 | 13 | 14 | 0.26 | "13년 이상 14년 미만" |
| 12 | 14 | 15 | 0.28 | "14년 이상 15년 미만" |
| 13 | 15 | Infinity | 0.30 | "15년 이상" |

> **v0.3-A 활용 변경**: 단계 4에서 다주택 중과 발동 시(`isHeavyTaxationApplicable === true`) 호출 측 `tax_engine.js`는 본 표 적용을 **건너뛴다** (제95조 ② 단서, 호출 측 §5-A). `appliedDeductionTable === null`로 설정. 본 표 자체는 변경되지 않는다.

### 3-3. LONG_TERM_DEDUCTION_TABLE_2_HOLDING / _RESIDENCE (v0.2 계승, v0.3-A 변경 없음)

v0.2.0 §3-3 그대로. **v0.3-A에서 변경 없음**.

#### 3-3-1. LONG_TERM_DEDUCTION_TABLE_2_HOLDING (표 2 좌측, 8행)

| idx | lowerBound | upperBound | rate | label |
|---|---|---|---|---|
| 1 | 3 | 4 | 0.12 | "3년 이상 4년 미만" |
| 2 | 4 | 5 | 0.16 | "4년 이상 5년 미만" |
| 3 | 5 | 6 | 0.20 | "5년 이상 6년 미만" |
| 4 | 6 | 7 | 0.24 | "6년 이상 7년 미만" |
| 5 | 7 | 8 | 0.28 | "7년 이상 8년 미만" |
| 6 | 8 | 9 | 0.32 | "8년 이상 9년 미만" |
| 7 | 9 | 10 | 0.36 | "9년 이상 10년 미만" |
| 8 | 10 | Infinity | 0.40 | "10년 이상" |

#### 3-3-2. LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE (표 2 우측, 9행, 단서 행 식별)

| idx | lowerBound | upperBound | rate | requiresHoldingMin3y | label |
|---|---|---|---|---|---|
| 1 | 2 | 3 | 0.08 | **true** | "2년 이상 3년 미만 (보유 3년 이상 한정)" |
| 2 | 3 | 4 | 0.12 | true | "3년 이상 4년 미만" |
| 3 | 4 | 5 | 0.16 | true | "4년 이상 5년 미만" |
| 4 | 5 | 6 | 0.20 | true | "5년 이상 6년 미만" |
| 5 | 6 | 7 | 0.24 | true | "6년 이상 7년 미만" |
| 6 | 7 | 8 | 0.28 | true | "7년 이상 8년 미만" |
| 7 | 8 | 9 | 0.32 | true | "8년 이상 9년 미만" |
| 8 | 9 | 10 | 0.36 | true | "9년 이상 10년 미만" |
| 9 | 10 | Infinity | 0.40 | true | "10년 이상" |

> **v0.3-A 영향**: 표 2는 1세대1주택 + 12억 초과 케이스 전용. 다주택 중과 발동 조건 4(`is1Se1House === false`)와 표 2 자격(`is1Se1House === true`)은 상호배타적이므로 **표 2와 다주택 중과는 동시에 발동하지 않는다**. 본 표는 v0.3-A에서 그대로 사용된다.

### 3-4. HIGH_VALUE_HOUSE_THRESHOLD (v0.2 계승, v0.3-A 변경 없음)

v0.2.0 §3-4 그대로.

```
HIGH_VALUE_HOUSE_THRESHOLD = 1200000000  // 12억원
```

### 3-5. NON_TAXABLE_HOLDING_MIN_YEARS / _RESIDENCE_MIN_YEARS (v0.2 계승, v0.3-A 변경 없음)

v0.2.0 §3-5 그대로.

```
NON_TAXABLE_HOLDING_MIN_YEARS    = 2  // 보유 2년 이상 (전국 공통)
NON_TAXABLE_RESIDENCE_MIN_YEARS  = 2  // 거주 2년 이상 (취득시 조정대상지역 한정)
```

> **인계 2 (정본 명칭) 영구 정착**: 호출 측 `tax_engine.md` v0.3-A §8-1은 본 정본 명칭만 사용한다. v0.2.1 모듈 스펙 §8-1의 별칭(`EXEMPTION_HOLDING_THRESHOLD_YEARS`·`EXEMPTION_RESIDENCE_THRESHOLD_MONTHS`)은 v0.3-A에서 **영구 제거** (호출 측 §8-1 본문에서 별칭 표기 삭제 — 본 작업 창 #11에서 처리). 단위 비교 식: `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12`.

### 3-6. v0.1·v0.2 계승 상수·메타데이터 상세

#### 3-6-1. 메타데이터

| 멤버 | 값 | 비고 |
|---|---|---|
| `RULE_VERSION` | **`"v0.3.0-post-20260510"`** | `taxResult.ruleVersion`에 그대로 기록. v0.2 → v0.3-A 갱신 |
| `APPLICABLE_SALE_DATE_FROM` | `"2026-05-10"` | 양도일이 이 날짜 이전이면 호출 측이 `OUT_OF_V01_SCOPE_DATE` issueFlag 발동 (v0.3-A에서도 발동 조건 그대로) |

##### 3-6-1-A. RULE_VERSION 갱신 영향 검토 (v0.3-A)

`RULE_VERSION` 갱신은 v0.2 → v0.3-A 패치의 **유일한 v0.1·v0.2 시그니처 변경**이다. v0.1·v0.2 회귀 테스트가 본 값을 단순 비교하지 않고 패턴(`/^v0\./`) 또는 존재 확인만 한다면 회귀 영향 없음. 단순 문자열 일치 검증 라인이 있다면 v0.3-A 회귀 테스트 추가 시 함께 갱신 (작업지시서 05 책임).

> **v0.2.0 → v0.3-A 회귀 보장 단서**: tax_rules.test.js에서 `assert.strictEqual(RULE_VERSION, 'v0.2.0-post-20260510')`처럼 strict-eq 검증 라인이 있는 경우, v0.3-A 패치 시 본 라인을 `'v0.3.0-post-20260510'`으로 갱신하는 것은 **회귀가 깨진 것이 아니라 의도된 1라인 갱신**으로 처리한다 (호출 측 작업지시서 04 §2-3 단서 패턴 그대로 적용).

#### 3-6-2. LAW_REFS (v0.2 10종 + v0.3-A 신규 1종 = 11종)

v0.2.0 §3-6-2의 10종에 v0.3-A 신규 1종 추가:

| 키 | 값 | v0.3-A 변경 |
|---|---|---|
| `incomeTaxAct` | `"소득세법 [법률 제21065호, 2026-01-02 시행]"` | 동일 |
| `incomeTaxEnforcement` | `"소득세법 시행령 [대통령령 제36129호, 2026-03-01 시행]"` | 동일 |
| `progressiveRate` | `"소득세법 제55조 제1항"` | 동일 |
| `transferTaxRate` | `"소득세법 제104조 제1항"` | 동일 |
| `basicDeduction` | `"소득세법 제103조"` | 동일 |
| `localIncomeTax` | `"지방세법 제103조의3"` | 동일 |
| `nonTaxation1Se1House` | `"소득세법 제89조 제1항 제3호, 시행령 제154조"` | 동일 |
| `highValueHouse` | `"소득세법 제95조 제3항, 시행령 제160조 제1항"` | 동일 |
| `longTermDeductionTable1` | `"소득세법 제95조 제2항 표 1, 시행령 제159조의3"` | 동일 |
| `longTermDeductionTable2` | `"소득세법 제95조 제2항 표 2, 시행령 제159조의4"` | 동일 |
| **`heavyTaxation`** (v0.3-A) | **`"소득세법 제104조 제7항, 시행령 제167조의3·제167조의10·제167조의11"`** | **신규** |

##### 3-6-2-A. heavyTaxation 키 인용 범위 (명세서 §3-1 본문 인용)

`heavyTaxation` 키는 다음 4개 영역의 issueFlag·결과 객체 메타에서 사용된다 (호출 측 `tax_engine.md` v0.3-A §6-A 카탈로그):

1. **HEAVY_TAXATION_APPLIED** (warning): 소득세법 제104조 ⑦ 본문
2. **HEAVY_TAXATION_2_HOUSES** (info): 소득세법 제104조 ⑦ 제3호 + 시행령 제167조의10
3. **HEAVY_TAXATION_3_HOUSES** (info): 소득세법 제104조 ⑦ 제4호 + 시행령 제167조의3
4. **LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY** (info): 소득세법 제95조 ② 단서

> **본 모듈 스펙은 issueFlag 카탈로그를 보유하지 않는다** (§0-2 위임). 본 키 라벨만 단일 보유.

#### 3-6-3. 금액·세율 상수 (v0.1·v0.2 그대로)

| 멤버 | 값 | 단위 | 근거 |
|---|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | `2500000` | 원 (정수) | 소득세법 제103조 |
| `LOCAL_INCOME_TAX_RATE` | `0.1` | 비율 | 지방세법 제103조의3 |
| `SHORT_TERM_RATE_UNDER_1Y` | `0.7` | 비율 | 소득세법 제104조 ① 제3호 |
| `SHORT_TERM_RATE_UNDER_2Y` | `0.6` | 비율 | 소득세법 제104조 ① 제2호 |
| `UNREGISTERED_RATE` | `0.7` | 비율 | 소득세법 제104조 ① 제1호 |

#### 3-6-4. HOLDING_PERIOD_BOUNDARY_YEARS (v0.2 계승)

```
HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]
```

§11-4 결정에 따라 본 임계는 **정수 연차 단위만 정의**. 일자 단위 ±3일 비교는 `tax_engine.js` 책임.

> **v0.3-A 검토 — 신규 임계 추가 없음**: 다주택 중과 발동 조건 3(양도일 ≥ 2026-05-10)은 `APPLICABLE_SALE_DATE_FROM` 단일 임계로 충분. 다주택 중과 단계 8 보유 < 2년 분기는 기존 [1, 2] 임계로 처리. 따라서 v0.3-A는 본 배열에 신규 임계를 추가하지 않는다 (§11-4-A).

### 3-A. HEAVY_TAX_RATE_ADDITION (v0.3-A 신규 — 다주택 중과 가산세율)

**근거**: 소득세법 제104조 제7항 본문 + 시행령 제167조의3 ① + 시행령 제167조의10 ①.

법령 본문(제104조 ⑦): "다음 각 호의 어느 하나에 해당하는 주택을 양도하는 경우 제55조제1항에 따른 세율에 100분의 20(제3호 및 제4호의 경우 100분의 30)을 더한 세율을 적용한다."

#### 3-A-1. 원소 스키마

```js
{
  idx:        number,     // 1~2
  houseCount: number,     // 정수 (2 또는 3)
  addition:   number,     // 0.20 또는 0.30
  label:      string,     // "1세대 2주택 중과 +20%p" 등
  lawRefKey:  string      // "heavyTaxation" (LAW_REFS 매핑용)
}
```

#### 3-A-2. 2개 원소 정답값 (제104조 ⑦ 본문 그대로)

| idx | houseCount | addition | label | lawRefKey |
|---|---|---|---|---|
| 1 | 2 | 0.20 | "1세대 2주택 중과 +20%p" | "heavyTaxation" |
| 2 | 3 | 0.30 | "1세대 3주택 이상 중과 +30%p" | "heavyTaxation" |

> **3주택 이상 클램프**: `houseCount >= 4`인 경우도 `addition = 0.30` 적용. 룩업 함수(`findHeavyTaxRateAddition`)가 클램프를 자동 처리 (§4-A-2). 본 표는 **2행만 보유**하며 `houseCount = 4, 5, ...` 행을 추가하지 않는다 (룩업 함수의 클램프 책임).

#### 3-A-3. 보장 (selfTest로 검증)

- 2행 `idx`·`houseCount`·`addition` 모두 정수 또는 정확한 비율.
- `houseCount[0] === 2`, `houseCount[1] === 3` (idx 1·2 순서 단조 증가).
- `addition[0] === 0.20`, `addition[1] === 0.30` (등차수열 동치이나 산식 표기 금지 — §0-1 원칙 (2)).
- 표 외 `houseCount` 처리: §4-A 클램프 정책 참조.

#### 3-A-4. 등차수열 산식 금지 명문화 (§0-1 원칙 (2) 직접 적용)

다음과 같은 등차수열 산식 표기는 본 모듈 코드 본문에서 **금지**한다.

```js
// 금지 패턴 (§0-1 원칙 (2) 위반)
addition = (houseCount - 1) * 0.10;   // ← 이 형태로 작성하지 말 것
```

이유: (1) 법령 본문은 "20% 또는 30%"의 두 분기 표로 명시되어 있으며 등차수열로 명문화되지 않았다. (2) 향후 가산세율이 변경되면(예: 2주택 +25%p로 개정) 등차수열은 깨지나 룩업 테이블은 행 단위 갱신만으로 대응 가능. (3) 의사결정 #5 강화 원칙 (2) "룩업 테이블 우선"의 직접 적용.

대신 다음 패턴을 사용한다:

```js
// 권장 패턴 (§0-1 원칙 (2) 준수)
addition = findHeavyTaxRateAddition(houseCount);   // 룩업 함수 호출
```

#### 3-A-5. 향후 v0.5+ 다중 가산세율 케이스 인계 (§11-6 TR-09 신규)

v0.5+ 단계에서 다른 중과 케이스(예: 비사업용 토지 중과 +10%p, 분양권 중과 등) 추가 시 본 룩업 테이블은 다음 옵션 중 하나로 확장된다:

| 옵션 | 형태 |
|---|---|
| (a) 단일 룩업 + 케이스 키 추가 | `HEAVY_TAX_RATE_ADDITION = [{ key: "house_2", addition: 0.20 }, { key: "house_3", addition: 0.30 }, { key: "land_nonbusiness", addition: 0.10 }, ...]` |
| (b) 케이스별 별도 룩업 테이블 | `HEAVY_TAX_RATE_ADDITION_HOUSE`, `HEAVY_TAX_RATE_ADDITION_LAND` 별도 보유 |

본 결정은 v0.5+ 단계에서 별도 논의 (§11-6 TR-09).

---

## 4. 헬퍼 함수 계약

### 4-1. findBracket(taxBase) — v0.1 계승

v0.1.1 §5 그대로. v0.2·v0.3-A 변경 없음.

| 항목 | 내용 |
|---|---|
| 입력 | `taxBase: number` (원 단위 정수, ≥ 0, 유한) |
| 출력 | `PROGRESSIVE_BRACKETS`의 한 원소 (참조 반환) |
| 경계 처리 | 상한 "이하" 기준. `14,000,000` → 1구간, `14,000,001` → 2구간 |
| 예외 | 음수·비정수·NaN·Infinity·문자열·null·undefined → `Error` throw |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |

> **v0.3-A 활용**: 단계 9에서 다주택 중과 발동 시 호출 측 `tax_engine.js`는 `findBracket(taxBase)`로 기본 누진 구간을 획득한 뒤, 해당 구간의 `marginalRate`에 `findHeavyTaxRateAddition(houseCount)`를 더한 합산 세율로 동적 재계산한다 (호출 측 §5-A-9).

### 4-2. findHoldingRate(holdingYears, table) — v0.2 계승

v0.2.0 §4-2 그대로. v0.3-A 변경 없음.

#### 4-2-1. 입력 검증·클램프 정책·sanity 케이스

v0.2.0 §4-2-1·§4-2-2·§4-2-3 그대로. 변경 없음.

> **v0.3-A 호출 차단**: 호출 측 `tax_engine.js`는 다주택 중과 발동 시(`isHeavyTaxationApplicable === true`) 본 함수를 호출하지 않는다 (제95조 ② 단서, 호출 측 §5-A-4). 본 함수 자체는 v0.3-A에서 변경되지 않는다.

### 4-3. findResidenceRate(residenceYears, holdingYears, table) — v0.2 계승

v0.2.0 §4-3 그대로. v0.3-A 변경 없음.

> **v0.3-A 호출 차단**: 표 2 자격(`is1Se1House === true`)과 다주택 중과 발동 조건 4(`is1Se1House === false`)는 상호배타적이므로 본 함수와 다주택 중과 분기는 동시에 활성화되지 않는다.

### 4-A. findHeavyTaxRateAddition(houseCount) — v0.3-A 신규

다주택 중과 가산세율 룩업 함수. **명세서 v0.3-A §3-2-2 정본 인용**.

| 항목 | 내용 |
|---|---|
| 입력 | `houseCount: number` (정수, ≥ 2) |
| 출력 | `addition: number` (`0.20` 또는 `0.30`) |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |
| 호출 측 | `tax_engine.js` 단계 9 (중과 누진세율 적용) — 호출 측 §5-A-9 |

#### 4-A-1. 입력 검증 (실패 시 throw)

| 입력 | 결과 | 사유 |
|---|---|---|
| `houseCount`가 비정수 | `Error` throw | `Number.isInteger(houseCount) === false` |
| `houseCount`가 NaN·Infinity·문자열·null·undefined | `Error` throw | 타입·유한성 |
| `houseCount < 2` | `Error` throw | 호출 측이 단계 4 진입 전 `isHeavyTaxationApplicable`로 차단해야 함 (호출 측 §5-5). 본 함수는 방어적으로 throw |

#### 4-A-2. 클램프 정책 (룩업 함수 내부 처리)

| 입력 | 반환값 | 사유 |
|---|---|---|
| `houseCount === 2` | **0.20** | 표 idx=1 (1세대 2주택 중과) |
| `houseCount === 3` | **0.30** | 표 idx=2 (1세대 3주택 이상 중과) |
| `houseCount >= 4` | **0.30** | **클램프**: 4주택 이상도 모두 idx=2 적용 (3주택 이상 중과 +30%p) |

> **클램프 의의**: 시행령 제167조의3 ①은 "1세대 3주택 이상에 해당하는 주택"으로 표기하며 4·5·... 주택을 별도 분기로 나누지 않는다. 따라서 4주택 이상도 모두 +30%p 적용. 본 클램프는 룩업 함수 내부에서 처리하며 호출 측이 별도 분기 처리할 필요 없음 (§0-1 원칙 (3) 산식 흐름 분리).

#### 4-A-3. 함수 시그니처 (참고 골격, 본문 산출 금지 — 의사결정 #9 v9)

```js
// js/tax_rules.js v0.3-A — 함수 시그니처 (본 모듈 스펙은 .js 본문 산출 금지)
function findHeavyTaxRateAddition(houseCount) {
  // 입력 검증 (§4-A-1)
  if (typeof houseCount !== 'number' || !Number.isInteger(houseCount) || houseCount < 2) {
    throw new Error('tax_rules.findHeavyTaxRateAddition: houseCount must be integer >= 2, got: ' + houseCount);
  }
  // 클램프: 3주택 이상은 모두 +30%p (§4-A-2)
  var key = houseCount >= 3 ? 3 : 2;
  for (var i = 0; i < HEAVY_TAX_RATE_ADDITION.length; i++) {
    if (HEAVY_TAX_RATE_ADDITION[i].houseCount === key) {
      return HEAVY_TAX_RATE_ADDITION[i].addition;
    }
  }
  throw new Error('tax_rules.findHeavyTaxRateAddition: unreachable (lookup table missing key)');
}
```

> **본 골격은 참고용**(시그니처·검증 흐름 명시). 실제 .js 본문 작성은 작업 창 #12 작업지시서 05 책임. 본 모듈 스펙은 의사결정 #9 v9에 따라 .js 본문 산출 금지.

#### 4-A-4. sanity 케이스 (selfTest §9-A-1 통합 검증 — 명세서 §10-2-1·§10-2-2 회귀 보호)

| 입력 | 출력 | 의의 | 골든셋 매핑 |
|---|---|---|---|
| `findHeavyTaxRateAddition(2)` | `0.20` | 2주택 중과 정확값 | TC-011 회귀 |
| `findHeavyTaxRateAddition(3)` | `0.30` | 3주택 정확값 | TC-012 회귀 |
| `findHeavyTaxRateAddition(4)` | `0.30` | 4주택 클램프 | 보강 |
| `findHeavyTaxRateAddition(10)` | `0.30` | 10주택 클램프 (극단값) | 보강 |

#### 4-A-5. throw 케이스 (입력 검증 회귀 테스트)

| 입력 | 결과 |
|---|---|
| `findHeavyTaxRateAddition(1)` | throw |
| `findHeavyTaxRateAddition(0)` | throw |
| `findHeavyTaxRateAddition(-1)` | throw |
| `findHeavyTaxRateAddition(2.5)` | throw (비정수) |
| `findHeavyTaxRateAddition(NaN)` | throw |
| `findHeavyTaxRateAddition(Infinity)` | throw |
| `findHeavyTaxRateAddition("2")` | throw (문자열) |
| `findHeavyTaxRateAddition(null)` | throw |
| `findHeavyTaxRateAddition(undefined)` | throw |

> 위 throw 케이스는 `tests/tax_rules.test.js` v0.3-A 신규 그룹에 포함되어야 한다 (작업지시서 05 책임).

---

## 5. 입력 검증 패턴 (v0.2.0 계승, v0.3-A 보강)

본 모듈의 모든 룩업 함수는 동일한 입력 검증 패턴을 따른다. v0.3-A는 v0.2.0 §5 패턴을 그대로 계승하며 `findHeavyTaxRateAddition`도 본 패턴을 따른다.

### 5-1. 공통 검증 절차

1. 첫 번째 검증: 타입·유한성. `Number.isInteger(x) && Number.isFinite(x)` 위반 시 throw.
2. 두 번째 검증: 음수·범위 차단.
   - `findBracket`: `taxBase < 0` 위반 시 throw.
   - `findHoldingRate`: `holdingYears < 0` 위반 시 throw.
   - `findResidenceRate`: `residenceYears < 0` 또는 `holdingYears < 0` 위반 시 throw.
   - **`findHeavyTaxRateAddition`** (v0.3-A): **`houseCount < 2` 위반 시 throw** (§4-A-1).
3. 세 번째 검증: 표 인자 유효성 (`findHoldingRate`·`findResidenceRate`만). `Array.isArray(table) && table.length > 0` 위반 시 throw. `findHeavyTaxRateAddition`은 표 인자를 받지 않으므로 본 단계 생략.
4. 검증 통과 후 클램프 정책 적용 (§6).

### 5-2. 에러 메시지 규약

`Error` throw 시 메시지는 다음 형식을 권고:

```
'tax_rules.{함수명}: {파라미터명} must be a non-negative integer, got: {value}'
'tax_rules.findHeavyTaxRateAddition: houseCount must be integer >= 2, got: {value}'
'tax_rules.{함수명}: table must be a non-empty array'
```

> 코드 본문 작성은 작업지시서 05가 결정. 본 모듈 스펙은 메시지 형식 권고만 명시.

### 5-3. 호출 측 처리

호출 측(`tax_engine.js`)은 본 모듈의 throw를 catch하지 않고 상위로 전파한다. 입력 정규화는 `validateCaseData(caseData)` 단계 0에서 미리 수행되어야 한다 (`input_collector.js` 책임).

> **v0.3-A 호출 측 책임 강화**: `findHeavyTaxRateAddition` 호출 시 `houseCount`가 2 미만이면 본 함수가 throw하지만, 정상 흐름에서는 호출 측이 단계 4 진입 전 `isHeavyTaxationApplicable(caseData, intermediates)`로 4단계 조건을 미리 평가하여 차단해야 한다 (호출 측 §5-5). 본 함수의 throw는 호출 측 코드 결함의 방어선.

---

## 6. 클램프 처리 (v0.2.0 계승, v0.3-A 보강)

### 6-1. 룩업 함수 클램프 정책 일람 (v0.3-A 갱신)

| 함수 | 입력 범위 | 클램프 정책 |
|---|---|---|
| `findBracket` | `taxBase >= 0` | 8구간 `Infinity` 자연 처리 |
| `findHoldingRate(_, TABLE_1)` | 0 ≤ holdingYears | < 3 → 0, ≥ 15 → 0.30 |
| `findHoldingRate(_, TABLE_2_HOLDING)` | 0 ≤ holdingYears | < 3 → 0, ≥ 10 → 0.40 |
| `findResidenceRate(_, _, TABLE_2_RESIDENCE)` | 0 ≤ residenceYears, 0 ≤ holdingYears | holdingYears < 3 → 0, residenceYears < 2 → 0, 2~3 단서 → 0.08 (보유 3년 이상에서만), ≥ 10 → 0.40 |
| **`findHeavyTaxRateAddition`** (v0.3-A) | **2 ≤ houseCount** | **`=== 2` → 0.20, `>= 3` → 0.30 (3주택 이상 클램프)** |

### 6-2. 호출 측 클램프 미적용 원칙 (v0.2.0 그대로)

`tax_engine.js`는 본 함수의 클램프 결과를 **그대로 사용**한다. `tax_engine.js`가 클램프 정책을 별도로 적용하지 않는다 (§0-1 원칙 (3) 산식 흐름 분리).

> **v0.3-A 호출 측 검증**: 호출 측 `tax_engine.js`가 `findHeavyTaxRateAddition(houseCount)` 호출 시 결과를 그대로 사용해야 하며, `if (houseCount >= 3) addition = 0.30; else addition = 0.20;` 같은 별도 분기를 작성하지 않아야 한다 (작업지시서 06 검증 항목).

---

## 7. 시행일 기반 분기 (v0.2.0 §7 그대로, v0.5+ 인계)

v0.3-A는 단일 시행일(2026-05-10) 후속 적용 규칙만 노출. 향후 법령 개정에 따른 시행일별 다중 규칙 보유가 필요한 경우(예: 강남3구·용산 한시 유예, B-023), v0.5+ 단계에서 다음 패턴 적용 검토:

```
// 향후 v0.5+ 검토용 패턴 (v0.3-A 미적용)
findRulesByDate(saleDate):
  if saleDate >= "2027-01-01" → return RULES_2027
  if saleDate >= "2026-05-10" → return RULES_2026_05_10
  else → throw 'saleDate < APPLICABLE_SALE_DATE_FROM'
```

v0.3-A에서는 단일 규칙 세트만 노출. 호출 측 `tax_engine.js`는 `saleDate < APPLICABLE_SALE_DATE_FROM`이면 `OUT_OF_V01_SCOPE_DATE` issueFlag 발동 후 결과 산출 진행 (현행 동작 유지).

> **인계 4 (시행령 제167조의10·11 단서 미처리) — 본 모듈 영향**: v0.3-A는 시행령 제167조의10 ① 단서(소형주택·수도권 외·취학 등 13종) 및 제167조의11 ① 단서(장기임대주택 등)를 미처리. 본 모듈은 가산세율 룩업만 보유하며, **중과 배제 사유 룩업 테이블은 v0.5+ 인계** (§11-6 TR-10 신규). 호출 측은 issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` (info)로 사용자 안내 (호출 측 §6-A).

본 패턴 채택 시점은 백로그 B-021 (법제처 OpenAPI 활용 검토)와 함께 판단.

---

## 8. 의존성 (v0.2.0 §8 계승, v0.3-A 보강)

### 8-1. 외부 의존

§1-4 참조. 외부 라이브러리·다른 TaxOpt 모듈·DOM 의존 없음.

### 8-2. `tax_engine.js` v0.3-A의 본 모듈 사용 항목 (v0.2.0 → v0.3-A 갱신)

본 모듈은 `tax_engine.js`에 read-only로만 노출된다. v0.3-A에서 `tax_engine.js`는 다음 항목을 본 모듈에서 읽는다:

| `tax_engine.js` 단계 | 본 모듈 사용 항목 (v0.2 + v0.3-A) |
|---|---|
| 단계 0 (validateCaseData) | `APPLICABLE_SALE_DATE_FROM` |
| 단계 2 (1세대1주택 비과세) | `HIGH_VALUE_HOUSE_THRESHOLD`, `NON_TAXABLE_HOLDING_MIN_YEARS`, `NON_TAXABLE_RESIDENCE_MIN_YEARS` |
| 단계 3 (고가주택 안분) | `HIGH_VALUE_HOUSE_THRESHOLD` |
| **단계 4 (장특공 — 중과 배제 분기 추가)** | `LONG_TERM_DEDUCTION_TABLE_1`, `LONG_TERM_DEDUCTION_TABLE_2_HOLDING`, `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`, `findHoldingRate`, `findResidenceRate` (v0.2 그대로). **v0.3-A 추가**: 중과 발동 시 본 멤버들 호출하지 않음 (`appliedDeductionTable = null`로 설정) |
| 단계 6 (기본공제) | `BASIC_DEDUCTION_AMOUNT` |
| **단계 9 (세율 — 중과 누진세율 분기 추가)** | `PROGRESSIVE_BRACKETS`, `findBracket`, `SHORT_TERM_RATE_UNDER_1Y`, `SHORT_TERM_RATE_UNDER_2Y` (v0.2 그대로). **v0.3-A 추가**: `findHeavyTaxRateAddition(houseCount)` (중과 발동 시 가산세율 획득) |
| 단계 11 (지방소득세) | `LOCAL_INCOME_TAX_RATE` |
| issueFlag 수집 | `APPLICABLE_SALE_DATE_FROM`, `HOLDING_PERIOD_BOUNDARY_YEARS`, `LAW_REFS` (v0.3-A 신규 키 `heavyTaxation` 사용 가능), `UNREGISTERED_RATE` |
| 결과 객체 메타 | `RULE_VERSION`, `LAW_REFS` |
| 부트스트랩 | `selfTest()` |

> `tax_engine.js`는 본 모듈의 객체를 변경하지 않는다 (§10 코드 작성 원칙).

### 8-3. 부트스트랩 가드 (호출 측, v0.3-A 보강)

`tax_engine.js` v0.3-A는 본 모듈 로드 후 다음 가드를 수행한다 (호출 측 `tax_engine.md` v0.3-A §8-2-2):

```
[가드 1] tax_rules selfTest 통과 확인 (v0.2 그대로)
  st = window.TaxOpt.taxRules.selfTest()
  if not st.ok → throw 'tax_rules selfTest failed'

[가드 2] v0.2 신규 멤버 노출 확인 (v0.2 그대로)
  if not LONG_TERM_DEDUCTION_TABLE_1 or not findHoldingRate
     → throw 'tax_engine v0.2: tax_rules v0.2 미로드'

[가드 2-A] v0.3-A 신규 멤버 노출 확인 (신규)
  if typeof findHeavyTaxRateAddition !== 'function'
     or not Array.isArray(HEAVY_TAX_RATE_ADDITION)
     → throw 'tax_engine v0.3-A: tax_rules v0.3-A (HEAVY_TAX_RATE_ADDITION 등) 미로드'
```

본 모듈은 가드 대상 멤버를 누락 없이 노출할 책임을 진다. `tax_rules.js`가 v0.2.0 상태로 남고 `tax_engine.js`만 v0.3-A로 갱신된 경우의 silent failure를 본 가드가 차단한다.

---

## 9. selfTest 검증 케이스 (v0.2.0 계승 + v0.3-A 신규)

### 9-1. selfTest 결과 구조 (v0.3-A 보강)

```
selfTest() => {
  ok: boolean,                                      // 7종 모두 ok이면 true (v0.2 6종 + v0.3-A 1종)
  continuity:               { ok, checks },         // v0.1 (PROGRESSIVE_BRACKETS 7개 등식)
  integers:                 { ok, fails },          // v0.1 (baseTax 8개 정수)
  monotonic:                { ok, fails },          // v0.1 (lowerBound·marginalRate·baseTax 단조성)
  longTermLookups: {                                // v0.2 (장특공 sanity 15건 통합)
    ok:                     boolean,
    table1Fails:            Array,                  // 표 1 sanity 5건
    table2HoldingFails:     Array,                  // 표 2 좌측 sanity 3건
    table2ResidenceFails:   Array                   // 표 2 우측 sanity 7건
  },
  heavyTaxAdditionLookups: {                        // v0.3-A 신규 (가산세율 sanity 4건 + throw 9건)
    ok:                     boolean,
    additionFails:          Array,                  // §4-A-4 sanity 4건
    throwFails:             Array                   // §4-A-5 throw 9건
  }
}
```

> **v0.1·v0.2 호환성**: v0.1·v0.2 호출 측은 `selfTest().ok`만 참조하므로 v0.3-A 신규 필드(`heavyTaxAdditionLookups`) 추가에 의한 회귀 영향 없음. 호환성 검증은 `tests/tax_rules.test.js` v0.3-A 신규 그룹에서 수행.

### 9-2. v0.1 자체검증 함수 (계승)

`verifyProgressiveContinuity()`, `verifyBaseTaxAreIntegers()`, `verifyMonotonic()` — v0.1.1 §6 그대로. v0.2·v0.3-A에서 변경 없음.

### 9-3. verifyLongTermLookups() (v0.2 계승, v0.3-A 변경 없음)

v0.2.0 §9-3 그대로.

| 항목 | 내용 |
|---|---|
| 출력 | `{ ok: boolean, table1Fails: Array, table2HoldingFails: Array, table2ResidenceFails: Array }` |
| 검증 내용 | §4-2-3 (표 1 5건 + 표 2 좌측 3건) + §4-3-3 (표 2 우측 7건) sanity 케이스 룩업 결과가 expected 일치 여부 |
| 부수효과 | 없음 |
| 호출 권장 | `selfTest()` 내부 1회 호출 |

### 9-A. verifyHeavyTaxRateAddition() (v0.3-A 신규)

다주택 중과 가산세율 룩업 sanity 통합 검증 함수.

| 항목 | 내용 |
|---|---|
| 출력 | `{ ok: boolean, additionFails: Array, throwFails: Array }` |
| 검증 내용 | §4-A-4 sanity 4건 (정상 입력) + §4-A-5 throw 케이스 9건 (예외 입력) |
| 부수효과 | 없음 (실패해도 throw 안 함, 결과 객체에 누적만) |
| 호출 권장 | `selfTest()` 내부 1회 호출 |

#### 9-A-1. additionFails 검증 케이스 (sanity 4건)

명세서 §10-2-1·§10-2-2 회귀 보호 + 클램프 검증:

| 입력 | expected | 의의 | 골든셋 매핑 |
|---|---|---|---|
| `findHeavyTaxRateAddition(2)` | `0.20` | 2주택 중과 정확값 | TC-011 회귀 |
| `findHeavyTaxRateAddition(3)` | `0.30` | 3주택 정확값 | TC-012 회귀 |
| `findHeavyTaxRateAddition(4)` | `0.30` | 4주택 클램프 | 보강 |
| `findHeavyTaxRateAddition(10)` | `0.30` | 10주택 클램프 (극단값) | 보강 |

#### 9-A-2. throwFails 검증 케이스 (예외 입력 9건)

각 케이스에 대해 **try-catch 후 catch 블록이 실행되었는지** 확인:

| 입력 | expected | 사유 |
|---|---|---|
| `findHeavyTaxRateAddition(1)` | throw | houseCount < 2 |
| `findHeavyTaxRateAddition(0)` | throw | houseCount < 2 |
| `findHeavyTaxRateAddition(-1)` | throw | 음수 |
| `findHeavyTaxRateAddition(2.5)` | throw | 비정수 |
| `findHeavyTaxRateAddition(NaN)` | throw | 타입·유한성 |
| `findHeavyTaxRateAddition(Infinity)` | throw | 타입·유한성 |
| `findHeavyTaxRateAddition("2")` | throw | 문자열 |
| `findHeavyTaxRateAddition(null)` | throw | null |
| `findHeavyTaxRateAddition(undefined)` | throw | undefined |

#### 9-A-3. 함수 시그니처 (참고 골격, 본문 산출 금지)

```js
// js/tax_rules.js v0.3-A — verifyHeavyTaxRateAddition 시그니처
function verifyHeavyTaxRateAddition() {
  var additionCases = [
    { input: 2,  expected: 0.20 },
    { input: 3,  expected: 0.30 },
    { input: 4,  expected: 0.30 },   // 클램프
    { input: 10, expected: 0.30 }    // 극단 클램프
  ];
  var throwCases = [1, 0, -1, 2.5, NaN, Infinity, "2", null, undefined];

  var additionFails = [];
  additionCases.forEach(function(c) {
    try {
      var actual = findHeavyTaxRateAddition(c.input);
      if (actual !== c.expected) additionFails.push({ input: c.input, expected: c.expected, actual: actual });
    } catch (e) {
      additionFails.push({ input: c.input, expected: c.expected, error: e.message });
    }
  });

  var throwFails = [];
  throwCases.forEach(function(input) {
    var threw = false;
    try { findHeavyTaxRateAddition(input); } catch (e) { threw = true; }
    if (!threw) throwFails.push({ input: input, expected: 'throw', actual: 'no throw' });
  });

  return { ok: (additionFails.length === 0) && (throwFails.length === 0), additionFails: additionFails, throwFails: throwFails };
}
```

> **본 골격은 참고용**. 실제 .js 본문 작성은 작업 창 #12 작업지시서 05 책임.

### 9-4. 호출 측 부트스트랩 가드

§8-3 참조. `selfTest()` 결과의 `ok === false`이면 호출 측이 `Error` throw하여 결과 산출을 차단한다.

> **v0.3-A 회귀 안전성**: `selfTest().ok === true`는 v0.2.0과 동일한 의미를 보존하면서 v0.3-A 신규 검증(`heavyTaxAdditionLookups.ok`)도 추가로 통과해야 한다. 즉 v0.3-A 코드의 `selfTest().ok`는 v0.2 6종 + v0.3-A 1종 = **7종 모두 ok**여야 true.

---

## 10. 코드 작성 시 원칙 (v0.2.0 §10 계승, v0.3-A 보강)

### 10-1. 본 모듈의 단일 책임

본 모듈은 **법령 명시 숫자·표·임계의 단일 보유자**다.

1. 법령 표(누진세율표·장특공 표 1·표 2·**다주택 중과 가산세율 표**)를 룩업 테이블 형태로 보유.
2. 룩업 함수(`findBracket`·`findHoldingRate`·`findResidenceRate`·**`findHeavyTaxRateAddition`**)를 노출.
3. 임계 상수(`HIGH_VALUE_HOUSE_THRESHOLD`·`BASIC_DEDUCTION_AMOUNT` 등)를 노출.
4. 메타데이터(`RULE_VERSION`·`LAW_REFS`·`APPLICABLE_SALE_DATE_FROM`)를 노출.
5. 자체검증 함수(`selfTest` 등 + **`verifyHeavyTaxRateAddition`**)를 노출.

### 10-2. 본 모듈이 하지 않는 것 (v0.2.0 그대로 + v0.3-A 보강)

| 항목 | 담당 모듈 | 근거 |
|---|---|---|
| `transferGain`·`taxBase` 등 13단계 파이프라인 산식 흐름 | `tax_engine.js` | §0-1 원칙 (3) |
| 보유기간 분기 판정 (`under1y`/`under2y`/`over2y`) | `tax_engine.js` | 날짜 비교는 입력 의존 |
| 동월동일 비교 (`addYearsAnchored`) | `tax_engine.js` | 입력 의존 산출 |
| `Math.floor` 절사 호출 | `tax_engine.js` | 산식 적용 후 단계 |
| `caseData` 정규화·검증 | `input_collector.js` | 입력 정규화 책임 |
| 화면 DOM 접근 | 본 모듈에서 일체 금지 | 모듈 격리 |
| 결과 화면 렌더링 | `result_renderer.js` | 출력 책임 분리 |
| 사용자 친화적 설명 문장 생성 | `explanation_engine.js` | 출력 책임 분리 |
| issueFlag 발동 조건 평가 | `tax_engine.js` (`collectIssueFlags`) | 본 모듈은 임계만 노출 |
| **`isHeavyTaxationApplicable(caseData, intermediates)` 4단계 조건 평가** (v0.3-A 신규) | **`tax_engine.js`** (호출 측 §5-5) | **§0-1 원칙 (3) — 조건 평가는 산식 흐름** |
| **단계 9 중과 누진세율 동적 재계산** (v0.3-A 신규) | **`tax_engine.js`** (호출 측 §5-A-9) | **§0-1 원칙 (3) — 산식 흐름은 호출 측 책임** |
| **중과 배제 사유 룩업** (시행령 제167조의10·11 단서, v0.3-A 미처리) | **post-MVP** (§11-6 TR-10) | **v0.3-A 범위 외** |

### 10-3. 함수 작성 원칙 (v0.2.0 그대로)

1. 모든 룩업 함수는 **순수 함수** (부수효과 없음, 입력 변경 없음, 결정적).
2. 모든 룩업 함수는 입력 검증 수행 후 비정수·음수·NaN·Infinity·문자열·null·undefined에 대해 `Error` throw.
3. 모든 룩업 함수는 클램프 정책을 함수 내부에서 처리. 호출 측이 클램프를 다시 적용하지 않는다.
4. 룩업 결과를 호출 측이 산식으로 보강하지 않는다 (§0-1 원칙 (2)·(3)).

> **v0.3-A `findHeavyTaxRateAddition` 적용 점검**:
> - 순수 함수 ✅ (입력 `houseCount`만 받아 `addition` 반환, 부수효과 없음)
> - 입력 검증 ✅ (§4-A-1, 비정수·NaN·문자열·`< 2` 모두 throw)
> - 클램프 정책 ✅ (§4-A-2, `>= 3` 자동 클램프)
> - 호출 측 산식 보강 금지 ✅ (§6-2-A, 호출 측 분기 처리 금지)

### 10-4. 자료 작성 원칙 (v0.2.0 그대로 + v0.3-A 보강)

1. 룩업 테이블은 **시행령 본문 그대로** 행 단위 보유. 등차수열 산식 표기 금지.
2. 룩업 테이블 각 행은 `lowerBound`·`upperBound`·`rate`·`label` 또는 (가산세율 룩업의 경우) `houseCount`·`addition`·`label` 명시.
3. 단서 행(거주 표 idx=1)은 `requiresHoldingMin3y` 메타필드로 표시.
4. 모든 금액 상수는 원 단위 정수.
5. **(v0.3-A 신규)** 다주택 중과 가산세율 룩업은 법령 본문(제104조 ⑦) 그대로 2행 보유. 등차수열 산식(`(houseCount−1) × 0.10`) 금지 (§3-A-4).

---

## 11. 미확정 항목 처리 (v0.2.0 §11 계승, v0.3-A 갱신)

### 11-1. tax_rules.js v0.2의 노출 형태 — 자동 해소 (v0.2.0 그대로)

v0.2.0 §11-1 본문 그대로. v0.2.1 정정에서 룩업 정본 확정으로 자동 해소되었다.

### 11-2. selfTest sanity 케이스 — 채택 (v0.2.0 그대로 + v0.3-A 추가)

v0.2.0 §11-2 본문 그대로. **v0.3-A 추가**: §9-A `verifyHeavyTaxRateAddition` 본문이 §4-A-4 sanity 4건 + §4-A-5 throw 9건을 통합 검증한다. 부트스트랩 부담은 단순 룩업 + try-catch이므로 수밀리초 부담, v0.2 추가 sanity 15건과 동일 수준.

**v0.3-A 추가 채택 근거**:
1. TC-011·012 골든셋 회귀 보호: `findHeavyTaxRateAddition(2) === 0.20` 또는 `(3) === 0.30` 한 행만 잘못 들어가도 TC-011·012 totalTax가 즉시 깨짐. 부트스트랩 시점에서 차단.
2. 클램프 정책 회귀 보호: `houseCount = 4` 클램프가 잘못 동작하면(예: `0.40` 반환) 향후 4주택 골든셋 추가 시 즉시 발견.
3. throw 케이스 회귀 보호: `houseCount = 1` 등이 throw하지 않으면 호출 측 silent failure 가능성.

### 11-3. Object.freeze 적용 여부 — 미적용 (v0.2.0 §11-3 계승)

v0.2.0 §11-3 본문 그대로. v0.3-A에서도 미적용. v0.3-B 시나리오 엔진 도입 시 재검토 (§11-6 TR-03).

### 11-4. HOLDING_PERIOD_BOUNDARY 임계 확장 — 정수 임계만 본 모듈에 정의 (v0.2.0 §11-4 계승)

v0.2.0 §11-4 본문 그대로.

#### 11-4-A. v0.3-A 신규 임계 추가 검토 — 추가 없음

다주택 중과 4단계 조건 평가에서 사용되는 임계는 다음과 같다:

| 조건 | 사용 임계 | 본 모듈 멤버 |
|---|---|---|
| 조건 1: `householdHouseCount >= 2` | 2 (정수) | (직접 비교, 별도 임계 멤버 불필요) |
| 조건 2: `saleRegulated === true` | (boolean 비교) | (해당 없음) |
| 조건 3: `saleDate >= APPLICABLE_SALE_DATE_FROM` | `"2026-05-10"` | `APPLICABLE_SALE_DATE_FROM` (v0.1 그대로) |
| 조건 4: `is1Se1House === false` | (boolean 비교) | (해당 없음) |
| 단계 8 분기: 보유 < 2년 + 중과 (제104조 ⑦ 본문 단서) | 2 (보유 임계) | `HOLDING_PERIOD_BOUNDARY_YEARS[1] === 2` (v0.2 그대로) |

→ v0.3-A는 본 임계 배열에 신규 임계를 추가하지 않는다 (§3-6-4 그대로).

### 11-5. UNREGISTERED_ASSET 이름 통일 — `UNREGISTERED_RATE` 유지 (v0.2.0 §11-5 계승)

v0.2.0 §11-5 본문 그대로. v0.3-A에서도 `UNREGISTERED_RATE` 유지.

### 11-6. 향후 v0.3+/v0.5+ 인계 항목 (v0.2.0 §11-6 계승 + v0.3-A 신규 2종)

| ID | 항목 | 인계 시점 | 비고 |
|---|---|---|---|
| TR-01 | ~~다주택 중과 세율표 (제104조 ⑦)~~ | ~~v0.3~~ | **v0.3-A에서 처리 완료** (§3-A `HEAVY_TAX_RATE_ADDITION` 룩업) |
| TR-02 | 일시적 2주택 비과세 임계 (시행령 제155조 ①) | v0.3-B 또는 v0.5 | 명세서 §1-4 결정 — 옵션 (나) 미포함 채택. 입력 스키마 확장 필요 |
| TR-03 | Object.freeze deep-freeze 적용 검토 | v0.3-B | §11-3 결정 재검토. 시나리오 엔진 도입 시 다중 시나리오 공유 보호 |
| TR-04 | 시행일별 다중 규칙 보유 (`findRulesByDate`) | v0.5+ | §7 패턴 채택. 법제처 OpenAPI 자동 갱신 (B-021) 도입 시 |
| TR-05 | 상속·증여 취득가액 산정 룰 (시행령 제163조) | v0.5+ | 매매취득 외 케이스 도입 시 |
| TR-06 | 공익사업 수용 등 거주요건 면제 사유 (시행령 제154조 ① 단서) | v0.4+ | `RESIDENCE_EXEMPTION_REASONS` 룩업 테이블 신규 |
| TR-07 | 미등기 → 등기 갱신·자산별 미등기 세율 차이 | v0.5+ | 현 `UNREGISTERED_RATE` 단일값을 자산별 룩업으로 확장 가능성 |
| TR-08 | 부칙·경과규정 본격 반영 (취득시기·계약시기 기준 종전규정) | v0.5+ | B-023 추적. 강남3구·용산 한시 유예 (계약 2026-05-09 이전 + 잔금 4개월 이내) 미처리. RULE_SETS 구조 + contractDate 입력 필드 추가 |
| **TR-09** (v0.3-A 신규) | **다중 가산세율 케이스 통합 (비사업용 토지 +10%p, 분양권 등)** | **v0.5+** | **§1-2-2 후속 재검토. 옵션 (a) 단일 룩업 vs (b) 케이스별 별도 테이블 결정** (§3-A-5) |
| **TR-10** (v0.3-A 신규) | **시행령 제167조의10·11 단서 (중과 배제 사유) 룩업화** | **post-MVP** | **§7 인계 4 — 소형주택·수도권 외·취학 등 13종 + 장기임대주택 등. 신규 입력 필드(`heavyTaxExclusionReason` 등) + 룩업 테이블 추가 필요. 호출 측 `HEAVY_TAX_EXCLUSION_NOT_HANDLED` issueFlag로 v0.3-A는 회피** |

> 본 표는 본 모듈 스펙 작성 중 발견한 v0.3+ 영향 항목. 각 항목은 백로그(B-024 등)에 별도 등록 예정.
>
> TR-08은 B-023과 직접 연계. v0.5+ 단계에서 B-021 (법제처 OpenAPI 활용)과 B-020 (의사결정 #5 강화 — 법령 개정 대응 아키텍처)와 함께 통합 처리.
>
> **TR-09·TR-10은 본 작업 창 #11에서 신규 식별**된 v0.5+/post-MVP 인계 항목. 백로그 등록 권고는 본 관제탑 책임 (작업 창 #11 외부).

### 11-7. v0.3-A 미해결 항목 — 없음

본 모듈 스펙 v0.3-A 작성 시점에서 v0.3-A 범위 내의 미해결 항목은 없다. 명세서 v0.3-A §15-5 짚을 부분 1·2(룩업 vs 산식 옵션·시행령 제167조의10·11 단서 미처리)는 모두 본 모듈 스펙에서 정본 처리(§1-2-1 옵션 (가) 채택, §11-6 TR-09·TR-10 인계 등록).

---

## 12. 작업지시서 05 입력 패키지 (Claude Code에 전달할 핵심 요약, v0.3-A)

작업 창 #12(작업지시서 05 작성)에 본 모듈 스펙과 함께 전달할 핵심 요약. Claude Code가 .js 작성 시 single source.

### 12-1. 핵심 결정 요약 (v0.2.0 §12-1 계승 + v0.3-A 갱신)

| 항목 | 결정 |
|---|---|
| 노출 객체 | `window.TaxOpt.taxRules` (IIFE, ES6 module 미사용) |
| 노출 멤버 | **26종** (v0.1 17 + v0.2 신규 7 + v0.3-A 신규 2) |
| 룩업 테이블 | **5종** — `PROGRESSIVE_BRACKETS`(8) + `LONG_TERM_DEDUCTION_TABLE_1`(13) + `_TABLE_2_HOLDING`(8) + `_TABLE_2_RESIDENCE`(9) + **`HEAVY_TAX_RATE_ADDITION`(2)** |
| 룩업 함수 | **4종** — `findBracket` + `findHoldingRate` + `findResidenceRate` + **`findHeavyTaxRateAddition`** |
| 입력 검증 | 모든 룩업 함수 비정수·음수·NaN·Infinity·문자열·null·undefined throw. **`findHeavyTaxRateAddition`은 추가로 `houseCount < 2` throw** |
| 클램프 정책 | 룩업 함수 내부 처리 (호출 측 클램프 미적용). **`findHeavyTaxRateAddition`은 `houseCount >= 3` 자동 클램프** |
| `Object.freeze` | 미적용 (§11-3) |
| `selfTest` | v0.1 3종 + v0.2 신규 1종(`verifyLongTermLookups`) + **v0.3-A 신규 1종(`verifyHeavyTaxRateAddition`)** = 5종 검증 함수 통합 |
| 미등기 멤버명 | `UNREGISTERED_RATE` 유지 (§11-5) |

### 12-2. v0.2.0 → v0.3-A 패치 변경 요약

1. `RULE_VERSION` 갱신: `"v0.2.0-post-20260510"` → `"v0.3.0-post-20260510"`
2. `LAW_REFS`에 v0.3-A 신규 1키 추가 (`heavyTaxation`)
3. 신규 룩업 테이블 1종: `HEAVY_TAX_RATE_ADDITION` (§3-A, 2행)
4. 신규 룩업 함수 1종: `findHeavyTaxRateAddition(houseCount)` (§4-A)
5. 신규 자체검증 함수 1종: `verifyHeavyTaxRateAddition()` (§9-A)
6. `selfTest()` 결과 객체에 `heavyTaxAdditionLookups` 필드 추가 (§9-1)
7. v0.2 멤버 24종 시그니처·값 모두 그대로 유지

### 12-3. 회귀 안전성 보장 항목 (v0.2 → v0.3-A 패치 후)

1. v0.2 selfTest 결과 `ok === true` (가산세율 sanity 추가만, 기존 검증 무영향)
2. v0.2 노출 24종 멤버 모두 그대로 접근 가능
3. v0.2 골든셋 TC-006~010이 v0.3-A 패치 후 그대로 통과 (호출 측 `tax_engine.js` v0.3-A 코드의 회귀 검증 책임)
4. v0.1 골든셋 TC-001~005가 v0.3-A 패치 후 그대로 통과 (`saleRegulated` 미입력 → 자동 보정 `false` → 중과 미발동)
5. 본 모듈 단독 회귀: tax_rules.test.js v0.2 baseline 150/0 그대로 유지 (v0.3-A 신규 그룹 추가 후 N/0, N ≥ 165)

### 12-4. 신규 검증 안전성 보장 항목 (v0.3-A 신규)

1. `findHeavyTaxRateAddition(2) === 0.20` (TC-011 회귀)
2. `findHeavyTaxRateAddition(3) === 0.30` (TC-012 회귀)
3. `findHeavyTaxRateAddition(4) === 0.30` (4주택 클램프)
4. `findHeavyTaxRateAddition(10) === 0.30` (10주택 극단 클램프)
5. `findHeavyTaxRateAddition(1)` throw
6. `findHeavyTaxRateAddition(0)` throw
7. `findHeavyTaxRateAddition(2.5)` throw (비정수)
8. `findHeavyTaxRateAddition(NaN)` throw
9. `findHeavyTaxRateAddition("2")` throw (문자열)
10. `findHeavyTaxRateAddition(null)` throw
11. `findHeavyTaxRateAddition(undefined)` throw
12. `HEAVY_TAX_RATE_ADDITION.length === 2`
13. `HEAVY_TAX_RATE_ADDITION[0].houseCount === 2 && HEAVY_TAX_RATE_ADDITION[0].addition === 0.20`
14. `HEAVY_TAX_RATE_ADDITION[1].houseCount === 3 && HEAVY_TAX_RATE_ADDITION[1].addition === 0.30`
15. `LAW_REFS.heavyTaxation` 존재 (string, 비어있지 않음)
16. `RULE_VERSION === "v0.3.0-post-20260510"`
17. `selfTest().ok === true` (v0.2 6종 + v0.3-A 1종 = 7종 모두 통과)
18. `selfTest().heavyTaxAdditionLookups.ok === true`
19. `typeof findHeavyTaxRateAddition === "function"`
20. `Array.isArray(HEAVY_TAX_RATE_ADDITION) === true`

---

## 13. 검증 체크리스트 (v0.2.0 §13 계승, v0.3-A 갱신)

본 모듈 스펙 작성 후, 그리고 작업지시서 05 산출 후, Claude Code 산출 .js 검증 시 사용.

### 13-1. 모듈 스펙 자체 (본 문서) 체크 (v0.2.0 §13-1 계승 + v0.3-A 추가)

- [ ] §3 4개 룩업 테이블이 시행령 본문 그대로 (산식 표기 없음) — v0.2.0 그대로
- [ ] **§3-A `HEAVY_TAX_RATE_ADDITION` 2행이 법령 본문(제104조 ⑦) 그대로 (등차수열 산식 표기 없음)** — v0.3-A 신규
- [ ] §3-3-1 표 2 좌측 8행, §3-3-2 표 2 우측 9행, §3-2-2 표 1 13행, **§3-A 가산세율 2행** — v0.3-A 신규 1행
- [ ] §3-3-2 표 2 우측 idx=1 행에 `requiresHoldingMin3y: true` 명시
- [ ] §4 4개 헬퍼 함수 시그니처·입력 검증·클램프 정책·sanity 케이스 명시 — v0.3-A `findHeavyTaxRateAddition` 추가
- [ ] §11 보류 항목 4건(§11-2~5) 결정 결과 + 근거 명시
- [ ] §11-1 자동 해소 + §11-6 v0.3+/v0.5+ 인계 명시 — **v0.3-A 신규 TR-09·TR-10 추가**
- [ ] §0-1 법령 개정 대응 아키텍처 인용 (§1-2) — **v0.3-A §1-2-1 옵션 (가) 채택 근거 명시**
- [ ] v0.2 회귀 안전성 보장 항목 명시 (§12-3)
- [ ] v0.3-A 신규 검증 안전성 보장 항목 명시 (§12-4) — **20건**

### 13-2. Claude Code 산출 `js/tax_rules.js` 체크 (v0.2.0 §13-2 계승 + v0.3-A 추가)

- [ ] `window.TaxOpt.taxRules` 노출 객체 **26종** 멤버 모두 정의
- [ ] **`RULE_VERSION === "v0.3.0-post-20260510"`** — v0.3-A 갱신
- [ ] **5개** 룩업 테이블 행 수 (8 + 13 + 8 + 9 + **2**) 일치
- [ ] 표 2 우측 idx=1 `requiresHoldingMin3y === true`
- [ ] **`HEAVY_TAX_RATE_ADDITION` 2행 정답값** (`{ houseCount: 2, addition: 0.20 }`, `{ houseCount: 3, addition: 0.30 }`)
- [ ] **4개** 헬퍼 함수 입력 검증 throw 동작 — `findHeavyTaxRateAddition` 9건 throw 검증
- [ ] 클램프 정책 함수 내부 처리 — `findHeavyTaxRateAddition` `houseCount >= 3` 클램프
- [ ] **`selfTest()` 7종 검증 통과** (`ok === true`) — v0.2 6종 + v0.3-A 1종
- [ ] `Object.freeze` 미적용
- [ ] `UNREGISTERED_RATE` 유지
- [ ] **`LAW_REFS.heavyTaxation` 존재** — v0.3-A 신규 키
- [ ] **`verifyHeavyTaxRateAddition()` 함수 정의 + selfTest 내부 호출**

### 13-3. Claude Code 산출 `tests/tax_rules.test.js` 체크 (v0.2.0 §13-3 계승 + v0.3-A 추가)

- [ ] v0.2 회귀 검증 그대로 통과 (Node.js v0.2 baseline 150/0 → v0.3-A 추가 후 N/0, N ≥ 165)
- [ ] **§12-4 신규 검증 항목 20건 모두 통과**
- [ ] `selfTest()` 결과 `longTermLookups.ok === true` (v0.2 그대로)
- [ ] **`selfTest()` 결과 `heavyTaxAdditionLookups.ok === true`** (v0.3-A 신규)

### 13-4. v0.3-A 골든셋 회귀 (작업지시서 06 단계 — 본 모듈 스펙 검증 후)

- [ ] TC-006~010 5건 totalTax 일치 (v0.2 회귀 — `tests/tax_engine.test.js`)
- [ ] TC-001~005 5건 totalTax 일치 (v0.1 회귀, 입력 패치 `householdHouseCount: 2` 적용 후)
- [ ] **TC-011 totalTax 검증 통과** (2주택 중과 +20%p, 검증팀 손계산 + 홈택스 모의계산 후 정답값 확정)
- [ ] **TC-012 totalTax 검증 통과** (3주택 중과 +30%p, 검증팀 손계산 + 홈택스 모의계산 후 정답값 확정)
- [ ] **TC-013 totalTax === 130,878,000** (= TC-008, 2주택 + saleRegulated=false 회귀)
- [ ] **TC-014 totalTax === 130,878,000** (= TC-008, 3주택 + saleRegulated=false 회귀)

---

## 14. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.2.0 | 2026-05-01 | 초기 작성. v0.1.1 modules/tax_rules.md (235줄) 베이스 + v0.2 신규 항목. (1) §1-2 §0-1 법령 개정 대응 아키텍처 인용. (2) §3 룩업 테이블 4종 정본 (PROGRESSIVE_BRACKETS 계승 + 장특공 표 1·2 좌·2 우 신규). (3) §4 헬퍼 함수 3종 (findBracket 계승 + findHoldingRate·findResidenceRate 신규). (4) §11 보류 항목 4건 결정. (5) §11-6 v0.3+ 인계 7건. (6) §12 작업지시서 03 입력 패키지. (7) §13 검증 체크리스트. (8) 5/1 보강 정정: §11-6 TR-08 (B-023 부칙·경과규정) 추가 + 백로그 ID 매핑 정정. |
| **v0.3-A** | **2026-05-02** | **본 버전. 작업 창 #11 산출.** v0.2.0 모듈 스펙 (820줄) 베이스 + v0.3-A 신규 영역 통합. (1) §0 변경 요약 신설 (v0.2 → v0.3-A 변경 영역 일람 + 본 모듈 스펙이 처리하지 않는 영역 호출 측 위임). (2) §1-2-1 옵션 (가) 채택 근거 명시 (인계 3 처리 — 가산세율 룩업 + 동적 재계산). (3) §1-3 변경 요약 표 v0.3-A 행 추가 (24종 → 26종). (4) §2-2 노출 멤버 일람 v0.3-A 갱신 (룩업 테이블 5종, 헬퍼 4종, 자체검증 6종). (5) §2-2-7 노출 멤버 합계 정합성 검산 표 신규 (인계 5 처리 — v0.1 17 + v0.2 7 + v0.3-A 2 = 26). (6) §3-A `HEAVY_TAX_RATE_ADDITION` 룩업 테이블 신규 (§3-A-1 스키마 + §3-A-2 2행 정답값 + §3-A-3 보장 + §3-A-4 등차수열 금지 명문화 + §3-A-5 v0.5+ 인계). (7) §4-A `findHeavyTaxRateAddition(houseCount)` 헬퍼 함수 신규 (§4-A-1 입력 검증 + §4-A-2 클램프 + §4-A-3 함수 시그니처 골격 + §4-A-4 sanity 4건 + §4-A-5 throw 9건). (8) §5 입력 검증 패턴 v0.3-A 보강 (`houseCount < 2` throw 추가). (9) §6-1 클램프 정책 일람 v0.3-A 추가 (`>= 3` 클램프). (10) §7 시행일 기반 분기 본문에 인계 4 (시행령 제167조의10·11 단서 미처리) 영향 명시. (11) §8 의존성 갱신 (v0.3-A 호출 측 사용 항목 + 부트스트랩 가드 2-A 추가). (12) §9-A `verifyHeavyTaxRateAddition()` 신규 (sanity 4건 + throw 9건 통합 검증). (13) §10-2 본 모듈이 하지 않는 것 v0.3-A 추가 (`isHeavyTaxationApplicable` + 단계 9 동적 재계산 + 중과 배제 사유). (14) §11-2 selfTest sanity v0.3-A 추가 채택 근거. (15) §11-4-A v0.3-A 신규 임계 추가 없음 결정. (16) §11-6 v0.5+ 인계 표 TR-09·TR-10 신규 추가. (17) §12 작업지시서 05 입력 패키지 갱신 (26종 + 신규 검증 20건). (18) §13 검증 체크리스트 v0.3-A 추가 (§12-4 신규 검증 20건 + TC-011~014 골든셋 4건). (19) **인계 5건 처리**: 인계 1 (B-032 결과 객체 구조) v0.3-A 범위 외 명시 (§0-2), 인계 2 (정본 명칭) §3-5 그대로 유지 + 별칭 영구 제거 명시, 인계 3 (룩업 vs 산식 옵션 (가) 채택) §1-2-1·§3-A-4·§11-6 TR-09 인계, 인계 4 (시행령 제167조의10·11 단서 미처리) §7·§10-2·§11-6 TR-10 인계, 인계 5 (멤버 수 정확 표기) §1-3·§2-2-7 + 시스템 프롬프트 충돌 명시. (20) 의사결정 #5 강화 (§0-1 법령 개정 대응 아키텍처) 본문 7회 인용 + 의사결정 #9 v9 (.js 본문 산출 금지) §4-A-3·§9-A-3 명시 + 의사결정 #11 (정확성 > 속도) 시간 제약 표기 없음. (21) 백로그 B-018·B-020·B-022·B-023·B-024·B-032·B-033 직접 인용. |
| v0.3-B | 미정 | 시나리오 엔진 도입 시 갱신. Object.freeze deep-freeze 적용 검토 (TR-03). |

---

## 부록 A — 자체 검증 결과 (작업 창 #11)

본 모듈 스펙 산출 직후 작업 창 #11이 수행한 자체 검증 5건 결과.

### A-1. 백로그 ID 정합성 (B-022·B-023·B-032·B-033 본문 정독 후 매핑)

| 백로그 ID | 본 모듈 스펙 인용 위치 | 정합성 |
|---|---|---|
| **B-022** (정수 처리 — 절사 vs 반올림) | 메타 표 + (호출 측 §7-3 위임) | ✅ — 본 모듈은 절사·반올림 적용 없음 (`tax_engine.js` 책임). v0.3-A 무영향, v0.5+ 인계. 호출 측 `tax_engine.md` v0.3-A에서 처리 |
| **B-023** (부칙·경과규정) | 메타 표 + §11-6 TR-08 + (호출 측 §6-A `HEAVY_TAX_TRANSITION_NOT_HANDLED` 위임) | ✅ — 강남3구·용산 한시 유예 (계약 2026-05-09 이전 + 잔금 4개월 이내) 본 모듈 미처리. post-MVP 인계, 입력 필드 `contractDate` 부재로 실 발동 빈도 0 |
| **B-032** (결과 객체 구조 명세 vs 코드 불일치) | 메타 표 + §0-2 (호출 측 위임) | ✅ — **인계 1 처리**: 본 모듈은 결과 객체 구조 미관여. 호출 측 `tax_engine.md` v0.3-A에서도 v0.3-A 범위 외 (v0.2.1 패턴 그대로 계승, 5/6 PRD 또는 v0.3-B 진입 시점 별도 처리) |
| **B-033** (자동 조정대상지역 판정) | 메타 표 + §11-6 TR (B-021 통합) | ✅ — **인계 3 처리**: 자동 판정은 post-MVP. v0.3-A는 사용자 직접 입력 가정. 본 모듈은 자동 판정 로직 미보유 (호출 측 `SALE_REGULATED_USER_INPUT` info issueFlag로 책임 명시) |
| B-024 (일시적 2주택 — 시행령 제155조 ①) | 메타 표 + §11-6 TR-02 | ✅ — 명세서 §1-4 결정 (옵션 (나) 미포함 채택) 본 모듈 스펙 그대로 따름. 본 모듈 영향 없음 |
| B-020 (의사결정 #5 강화 — 법령 개정 대응 아키텍처) | 메타 표·§1-2 인용 7회·§3-A 룩업 정본·§4-A 산식 흐름 분리 | ✅ — 원칙 (1)(2)(3) 본문 모두 7회 이상 명시. v0.3-A `HEAVY_TAX_RATE_ADDITION` 룩업이 본 원칙의 직접 적용 |

> "...로 추정" 표기 사용 없음. 모든 백로그 본문 정독 후 인용.

### A-2. 명세서 v0.3-A 인용 정합성 (§3·§4·§5·§6·§15-5 정독 후 인용)

| 본 모듈 스펙 §X | 명세서 v0.3-A §Y 정독 후 인용 |
|---|---|
| §0 변경 요약 | 명세서 §0 (v0.2.1 → v0.3-A 변경 요약 표) + §12 (변경 요약) |
| §0-1 / §0-2 | 명세서 §0-1 (법령 개정 대응 아키텍처) + §0-1-2 (옵션 (가) 채택 근거) |
| §1-2-1 (옵션 (가) 채택) | 명세서 §0-1-2 본문 (장점·단점·채택 근거) |
| §1-3 (변경 요약 표) | 명세서 §12-1 + §9-2 (노출 멤버 26종 합계) |
| §3-A (룩업 테이블) | 명세서 §3-2-1 (룩업 테이블 정의) + §3-2-2 (룩업 함수 시그니처) |
| §4-A (헬퍼 함수) | 명세서 §3-2-2 (룩업 함수 시그니처) + 본문 클램프 표 |
| §5 (입력 검증 패턴) | 명세서 §3-2-2 본문 (`houseCount < 2` throw) |
| §6-1 (클램프 정책) | 명세서 §3-2-2 클램프 표 (3주택+ → 0.30) |
| §8-3 (부트스트랩 가드) | 명세서 §9-4 (부트스트랩 가드 본문 그대로) |
| §9-A (verifyHeavyTaxRateAddition) | 명세서 §3-2-2 (sanity 4건) + 본 모듈 자체 산출 (throw 9건) |
| §10-2 (본 모듈이 하지 않는 것) | 명세서 §3-1 (조건 평가 — `tax_engine.js` 책임) + §3-4 (산식 흐름 — `tax_engine.js` 책임) |
| §11-6 TR-09·TR-10 | 명세서 §15-5 짚을 부분 1·2 (룩업 vs 산식 트레이드오프 + 시행령 제167조의10·11 단서 미처리) |

### A-3. v0.2 회귀 안전성 검증

| 항목 | 검증 결과 |
|---|---|
| v0.2 24종 노출 멤버 시그니처·반환 형식 보존 | ✅ — §1-3 표 명시 (`RULE_VERSION` 문자열 갱신만 예외) |
| v0.2 회귀 테스트 baseline 150/0 통과 가능 | ✅ — §12-3 #5 명시. v0.3-A 신규 그룹은 append만 |
| v0.2 selfTest `ok === true` 보존 | ✅ — §9-1 7종 검증 모두 통과 시 true. v0.2 6종은 그대로 통과 |
| v0.2 골든셋 TC-006~010 회귀 통과 가능 | ✅ — `saleRegulated=false` 명시 → 호출 측 중과 미발동 → v0.2 결과 그대로 |
| v0.1 골든셋 TC-001~005 회귀 통과 가능 | ✅ — `saleRegulated` 미입력 → 자동 보정 `false` → 중과 미발동 → v0.1 결과 그대로 |
| `tax_rules.js` v0.2 noop 호출 패턴 영향 없음 | ✅ — `findHeavyTaxRateAddition`은 v0.3-A 신규 노출이며 v0.2 호출 측은 호출하지 않음 |

### A-4. v0.3-A 신규 검증 항목 명시

| 명세서 §X / 본 모듈 §Y 검증 항목 | 본 모듈 스펙 매핑 |
|---|---|
| §3-A-2 룩업 테이블 정답값 (2행) | §12-4 #13·#14 |
| §3-A-3 sanity 보장 (idx·houseCount·addition) | §9-A-1 |
| §3-A-4 등차수열 산식 금지 | §10-4 #5 + §13-1 (체크리스트) |
| §4-A-1 입력 검증 throw (9건) | §9-A-2 + §12-4 #5~#11 |
| §4-A-2 클램프 정책 (`>= 3` → 0.30) | §6-1 + §9-A-1 #3·#4 + §12-4 #3·#4 |
| §9-A `verifyHeavyTaxRateAddition` 통합 검증 | §9-A-1 + §9-A-2 |
| selfTest 보강 (`heavyTaxAdditionLookups` 필드) | §9-1 + §13-2 + §12-4 #18 |

### A-5. 자체 발견 짚을 부분 (3건)

본 모듈 스펙 작성 중 발견한 짚을 부분 3건. Claude Code 실행(작업 창 #12) 또는 호출 측 `tax_engine.md` v0.3-A 정합성 점검 시 추가 확인 필요.

#### 짚을 부분 1: 시스템 프롬프트의 "신규 7종" vs 명세서 §3-6 "신규 5종 + 보조 3종 = 8종" 카운팅 불일치

- **현상**: 본 작업 창의 시스템 프롬프트는 v0.3-A issueFlag를 "신규 7종"으로 표기. 명세서 §3-6-4는 "v0.3-A 신규 5종 + 보조 3종 = 8종 (단, OUT_OF_V01_SCOPE_REGULATED_AREA 폐기 1종 차감 → 활성 25종)"으로 명시. **8 − 1 = 7**의 산술적 결과는 일치하나, 표기 방식이 상이.
- **본 모듈 스펙 처리**: 본 모듈은 issueFlag 카탈로그를 보유하지 않으므로(§0-2 호출 측 위임) 본 짚을 부분은 호출 측 `tax_engine.md` v0.3-A §6-A에서 정확 표기 (**"신규 5종 + 보조 3종 = 8종, 폐기 1종 차감, 활성 25종"** 명세서 §3-6 정본 채택).
- **후속 확인 필요**: 본 관제탑이 시스템 프롬프트 표기를 명세서 정본과 일관되게 정정 권고 (작업 창 #11 외부, 백로그 등록 권고).

#### 짚을 부분 2: `findHeavyTaxRateAddition(1)` throw — 호출 측 사전 차단 가정의 견고성

- **현상**: 명세서 §3-2-2는 `houseCount = 1` 입력 시 throw로 명시하며, "호출 측이 단계 4 진입 전 isHeavyTaxationApplicable로 차단해야 함"을 가정. 그러나 호출 측 코드 결함(예: 4단계 조건 평가 로직 버그)으로 단주택(`householdHouseCount === 1`) 케이스가 단계 9까지 도달할 가능성 존재.
- **본 모듈 스펙 처리**: §4-A-1 입력 검증의 `houseCount < 2` throw는 호출 측 결함의 **방어선** 역할. throw 메시지에 사유 명시(`'houseCount must be integer >= 2, got: 1'`)하여 디버깅 용이.
- **후속 확인 필요**: 호출 측 `tax_engine.md` v0.3-A §5-5 `isHeavyTaxationApplicable` 함수가 4단계 조건 모두 평가하는지 작업 창 #12 검증 필수. 본 함수의 throw가 silent failure 없이 사용자에게 명시적 오류로 전파되는지 호출 측 fail-fast 정책 점검.

#### 짚을 부분 3: `LAW_REFS.heavyTaxation` 키 라벨에 시행령 제167조의10·11 포함 — 미처리 영역 명시 vs 사용자 혼란 가능성

- **현상**: §3-6-2 `LAW_REFS.heavyTaxation` 라벨을 `"소득세법 제104조 제7항, 시행령 제167조의3·제167조의10·제167조의11"`로 표기. 그러나 v0.3-A는 시행령 제167조의10·11 단서(중과 배제 사유)를 미처리(인계 4, §11-6 TR-10). 라벨에 미처리 시행령이 포함되어 사용자가 "본 모듈이 시행령 제167조의10·11을 모두 반영했다"고 오해할 가능성.
- **본 모듈 스펙 처리**: 라벨 자체는 법령 본조 인용 표기로 유지(검증팀 손계산 근거 일관성). 호출 측 `tax_engine.md` v0.3-A §6-A `HEAVY_TAX_EXCLUSION_NOT_HANDLED` issueFlag (info) 발동으로 사용자에게 미처리 영역 명시.
- **후속 확인 필요**: 호출 측 `result_renderer.js`(또는 `explanation_engine.js`)가 `HEAVY_TAX_EXCLUSION_NOT_HANDLED` issueFlag 발동 시 "시행령 제167조의10·11 단서(소형주택·장기임대주택 등 중과 배제 사유)는 본 시뮬레이션에 반영되지 않았습니다. 전문가 검토 필요"를 화면에 명시 표시하는지 v0.4+ UI 작업에서 점검.

### A-6. 인용 자료 미비 — 없음

본 모듈 스펙 작성 중 인용한 자료는 모두 프로젝트 지식에 영속화된 정본 문서(명세서 v0.3-A, v0.2.0 모듈 스펙, v0.2.1 모듈 스펙, 작업지시서 03·04, 의사결정 #1·#5·#9·#11·#12, 백로그 B-022·B-023·B-024·B-032·B-033, 소득세법·시행령 PDF)이며 미비 항목 없음.

### A-7. 자체 sanity 검증

| 항목 | 결과 |
|---|---|
| §3-A-2 `HEAVY_TAX_RATE_ADDITION` 2행 카운트 | ✅ 2행 (idx 1·2) |
| §3-2-2 표 1 13행 카운트 (v0.2 그대로) | ✅ 13행 |
| §3-3-1 표 2 좌측 8행 카운트 (v0.2 그대로) | ✅ 8행 |
| §3-3-2 표 2 우측 9행 카운트 + idx=1 단서 행 표기 (v0.2 그대로) | ✅ 9행 + idx=1 단서 |
| §1-3 v0.3-A 신규 노출 멤버 카운트 (v0.2 24 + v0.3-A 2 = 26종) | ✅ 26종 |
| §2-2-7 노출 멤버 합계 정합성 검산 (17 + 7 + 2 = 26) | ✅ 검산 통과 |
| §9-1 selfTest 결과 구조 (v0.2 6종 + v0.3-A 1종 = 7종) | ✅ 7종 |
| §12-4 신규 검증 안전성 보장 항목 20건 | ✅ 20건 (sanity 4 + throw 9 + 룩업 테이블 자체 검증 4 + 메타 3) |
| §13-1 모듈 스펙 자체 체크 v0.3-A 추가 항목 | ✅ 6건 추가 |

### A-8. 차단 사항

본 모듈 스펙 작성 완료. 차단 사항 0건.

후속 작업 창(#12 작업지시서 05 — `tax_rules.js` v0.3-A 패치) 진입 가능 상태. 호출 측 모듈 스펙 `tax_engine.md` v0.3-A는 본 작업 창에서 동시 산출 (별도 파일).

---

본 문서는 v0.3-A 명세서가 변경되지 않는 한 함께 변경되지 않는다. v0.3-B에서 시나리오 엔진이 도입되면 별도로 `docs/v0.3-B/modules/tax_rules.md`를 작성하거나 본 문서를 v0.3-B로 갱신한다 (Object.freeze 검토 — TR-03).

(끝)
