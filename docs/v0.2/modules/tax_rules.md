# tax_rules.js 모듈 스펙 v0.2.0

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.2/modules/tax_rules.md` |
| 버전 | v0.2.0 |
| 상태 | 작성 완료 (2026-05-01) |
| 작성 출처 | 작업 창 #7 (v0.2 모듈 스펙 작성 전용) |
| 대상 코드 | `js/tax_rules.js` (v0.1 → v0.2 패치 대상, Claude Code 산출) |
| 대상 테스트 | `tests/tax_rules.test.js` (v0.1 → v0.2 패치 대상, Claude Code 산출) |
| 관련 작업지시서 | `docs/05_code_work_orders/03_tax_rules_v0.2.md` (예정, 5/1 작업 창 #8 산출) |
| 관련 명세서 | `docs/v0.2/01_calc_engine_spec.md` v0.2.1 (✅ 검증 통과, KPI 100%, 2026-04-30) |
| 호출 측 모듈 스펙 | `docs/v0.2/modules/tax_engine.md` v0.2.1 (룩업 호출 패턴 정본) |
| 관련 골든셋 | `docs/v0.2/06_test_cases.md` v0.2.1 (TC-006~010, ✅ 3자 일치) + `docs/v0.1/06_test_cases.md` (TC-001~005, 회귀) |
| 이전 버전 | v0.1.1 (`docs/v0.1/modules/tax_rules.md`, 4/29 GitHub Pages 라이브 검증 통과) |
| 다음 버전 | v0.3 (다주택 중과 세율표·시나리오 엔진 도입 시 갱신) |
| 관련 의사결정 | `docs/99_decision_log.md` #5 강화 (법령 개정 대응 아키텍처), #6 (영속화 의무), #9 v9 (.js 본문 산출 금지), #10 (D안 — v0.3 적용) |
| 관련 백로그 | B-018 (5/7 발표 PT 보조 슬라이드 — 5/5 처리), B-020 (의사결정 #5 강화 — 법령 개정 대응 아키텍처 명문화 — v0.2.1 §0-1 사전 적용), B-021 (법제처 OpenAPI 활용 검토 — §7 시행일별 다중 규칙 패턴 인계), B-022 (양도소득세 정수 처리 — 절사·반올림 정당성 확인 후 산식 정정), B-023 (양도소득세 부칙·경과규정 본격 반영 — §11-6 TR-08 인계) |

---

## 1. 개요

### 1-1. 목적

본 문서는 `js/tax_rules.js` v0.2의 **계약 문서**다. 호출하는 측(`tax_engine.js` v0.2 등)이 본 모듈을 어떻게 사용해야 하는지, 본 모듈이 무엇을 보장하는지를 정의한다.

코드 본문(`js/tax_rules.js`)과 본 문서가 충돌하면 **본 문서를 우선**한다. 코드 본문이 본 문서와 다르면 코드를 수정한다. 본 문서를 변경해야 하는 경우는 v0.2 명세서가 변경된 경우뿐이며, 그때는 명세서 → 본 문서 → 코드 순으로 갱신한다.

### 1-2. §0-1 법령 개정 대응 아키텍처 인용 (의사결정 #5 강화)

본 모듈은 명세서 v0.2.1 §0-1이 정의한 **법령 개정 대응 아키텍처의 단일 소스 모듈**이다.

| 원칙 | 본 모듈에서의 의미 |
|---|---|
| (1) **단일 소스** | 법령 명시 숫자(임계 금액·세율·공제율 표·연차 분기 임계)는 모두 본 모듈 한 곳에만 둔다. `tax_engine.js`·`scenario_engine.js`·`input_collector.js` 어느 다른 모듈도 법령 숫자를 직접 보유하지 않는다. |
| (2) **룩업 테이블 우선** | 법령 표(누진세율표·장특공 표 1·표 2)는 표 그대로 룩업 테이블 형태로 정의한다. `0.06 + (n−3) × 0.02` 같은 등차수열 산식이 표와 결과가 동치이더라도 산식 형태는 금지한다. |
| (3) **산식 흐름 분리** | 본 모듈은 데이터·룩업 함수만 노출한다. 13단계 산식 흐름·절사·합계는 `tax_engine.js`가 담당한다. |

법령 개정 시 수정 범위를 본 모듈 한 곳으로 한정하여 회귀 위험을 차단하고, 향후 법제처 OpenAPI 자동 갱신(B-021) 시 자동화 대상을 본 모듈로 한정한다.

### 1-3. v0.1.1 → v0.2.0 변경 요약

| 영역 | v0.1.1 | v0.2.0 |
|---|---|---|
| 노출 멤버 | 17종 | **24종** (v0.1 17종 + 신규 7종) |
| 신규 노출 — 룩업 테이블 | — | `LONG_TERM_DEDUCTION_TABLE_1`, `LONG_TERM_DEDUCTION_TABLE_2_HOLDING`, `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE` |
| 신규 노출 — 임계 | — | `HIGH_VALUE_HOUSE_THRESHOLD`, `NON_TAXABLE_HOLDING_MIN_YEARS`, `NON_TAXABLE_RESIDENCE_MIN_YEARS` |
| 신규 노출 — 룩업 함수 | — | `findHoldingRate`, `findResidenceRate` |
| 신규 노출 — 임계 배열 | — | `HOLDING_PERIOD_BOUNDARY_YEARS` (정수 임계, `[1, 2, 3, 15]`) |
| `selfTest()` | 종합 자체검증 (연속성·정수성·단조성) | + 장특공 표 3종 룩업 sanity 검증 (TC-007·008·009·010 회귀 보호) |
| `RULE_VERSION` | `"v0.1.1-post-20260510"` | `"v0.2.0-post-20260510"` |
| `Object.freeze` | 미적용 | **미적용** (v0.1 정책 계승, §11-3 결정) |

> v0.1 노출 멤버는 모두 시그니처·값 그대로 유지한다. v0.2 패치는 **신규 추가만**이며 v0.1 회귀를 깨지 않는다. 단 `RULE_VERSION` 문자열만 갱신한다.

### 1-4. 의존성 (요약)

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

ES6 module(`import`/`export`)을 사용하지 않는다 (의사결정 #5). 비-모듈 `<script src>` 다중 로드 방식이며, IIFE로 감싸 전역 오염을 최소화한다. `window`가 없는 환경(Node.js 등)에서는 `globalThis`로 fallback한다 (v0.1과 동일).

### 2-2. 노출 멤버 일람 (v0.1 계승 17종 + v0.2 신규 7종 = 24종)

> v0.2 신규는 **굵게**.

#### 2-2-1. 메타데이터 (3종, v0.1 계승)

| 멤버 | 타입 | 역할 | v0.2 변경 |
|---|---|---|---|
| `RULE_VERSION` | string | 결과 객체에 기록할 규칙 버전 식별자 | **`"v0.2.0-post-20260510"`로 갱신** |
| `APPLICABLE_SALE_DATE_FROM` | string (ISO date) | 본 규칙이 적용되는 양도일 하한 | 동일 (`"2026-05-10"`) |
| `LAW_REFS` | object | 적용 법령 라벨 (v0.1 6종 + **v0.2 신규 4종 = 10종**) | 멤버 수만 확장 |

#### 2-2-2. 금액·세율·임계 상수 (8종)

| 멤버 | 타입 | 값 | v0.2 변경 |
|---|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | number (정수) | 2,500,000 | 동일 |
| `LOCAL_INCOME_TAX_RATE` | number | 0.1 | 동일 |
| `SHORT_TERM_RATE_UNDER_1Y` | number | 0.7 | 동일 |
| `SHORT_TERM_RATE_UNDER_2Y` | number | 0.6 | 동일 |
| `UNREGISTERED_RATE` | number | 0.7 | 동일 (이름 유지, §11-5 결정) |
| **`HIGH_VALUE_HOUSE_THRESHOLD`** | number (정수) | **1,200,000,000** | **신규** |
| **`NON_TAXABLE_HOLDING_MIN_YEARS`** | number (정수) | **2** | **신규** |
| **`NON_TAXABLE_RESIDENCE_MIN_YEARS`** | number (정수) | **2** | **신규** |

#### 2-2-3. 룩업 테이블 (4종)

| 멤버 | 타입 | 행 수 | v0.2 변경 |
|---|---|---|---|
| `PROGRESSIVE_BRACKETS` | object[] | 8 | 동일 |
| **`LONG_TERM_DEDUCTION_TABLE_1`** | object[] | **13** | **신규 — 룩업 정본** |
| **`LONG_TERM_DEDUCTION_TABLE_2_HOLDING`** | object[] | **8** | **신규 — 룩업 정본** |
| **`LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`** | object[] | **9** | **신규 — 단서 행 포함** |

#### 2-2-4. 임계 배열 (1종)

| 멤버 | 타입 | 값 | v0.2 변경 |
|---|---|---|---|
| **`HOLDING_PERIOD_BOUNDARY_YEARS`** | number[] | **`[1, 2, 3, 15]`** | **신규** (§11-4 결정) |

#### 2-2-5. 헬퍼 함수 (3종)

| 멤버 | 타입 | v0.2 변경 |
|---|---|---|
| `findBracket(taxBase)` | function | 동일 |
| **`findHoldingRate(holdingYears, table)`** | function | **신규** |
| **`findResidenceRate(residenceYears, holdingYears, table)`** | function | **신규** |

#### 2-2-6. 자체검증 함수 (5종, v0.1 4종 + v0.2 1종 통합)

| 멤버 | 타입 | v0.2 변경 |
|---|---|---|
| `selfTest()` | function | 본문 보강 (장특공 sanity 3종 추가, §9) |
| `verifyProgressiveContinuity()` | function | 동일 |
| `verifyBaseTaxAreIntegers()` | function | 동일 |
| `verifyMonotonic()` | function | 동일 |
| **`verifyLongTermLookups()`** | function | **신규** (장특공 표 1·2 좌·2 우 sanity 통합 검증) |

---

## 3. 데이터 정의

### 3-1. PROGRESSIVE_BRACKETS (v0.1 계승)

v0.1.1 §4 그대로. 8개 원소, 누진 연속성·정수성·단조성 모두 v0.1 selfTest로 보장. **v0.2에서 변경 없음**.

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

### 3-2. LONG_TERM_DEDUCTION_TABLE_1 (v0.2 신규 — 장특공 표 1, 일반)

**근거**: 소득세법 제95조 제2항 표 1 (시행령 제159조의3 위임).

#### 3-2-1. 원소 스키마

```js
{
  idx:        number,     // 1~13
  lowerBound: number,     // 정수, 보유연수 하한 (포함, 단위: 년)
  upperBound: number,     // 정수 또는 Infinity (13행만)
  rate:       number,     // 0.06, 0.08, ..., 0.30
  label:      string      // "3년 이상 4년 미만" 등
}
```

#### 3-2-2. 13개 원소 정답값 (시행령 제95조 ② 표 1 본문 그대로)

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

#### 3-2-3. 보장 (selfTest로 검증)

- 13행 `lowerBound`·`upperBound`·`rate` 모두 정수 또는 정확한 비율 (부동소수점 표현 가능 범위 내).
- `lowerBound[i] === upperBound[i-1]` (i = 2..13) — 행 사이 공백·중복 없음.
- `rate[i] > rate[i-1]` — 엄격 단조 증가.
- 표 외 보유연수 처리: §6 클램프 정책 참조.

### 3-3. LONG_TERM_DEDUCTION_TABLE_2_HOLDING / _RESIDENCE (v0.2 신규)

**근거**: 소득세법 제95조 제2항 표 2 (시행령 제159조의4 위임). 좌측·우측을 각각 별도 룩업 테이블로 분리 정의.

#### 3-3-1. LONG_TERM_DEDUCTION_TABLE_2_HOLDING (표 2 좌측, 보유공제율)

원소 스키마는 표 1과 동일 (`idx`, `lowerBound`, `upperBound`, `rate`, `label`).

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

> 표 1은 13행(15년까지), 표 2 좌측은 8행(10년까지) — **상한이 다름**. 같은 등차수열로 보일 수 있으나 v0.2.1 정정에 따라 산식 표기 금지(§0-1 원칙 (2)).

#### 3-3-2. LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE (표 2 우측, 거주공제율 — 단서 행 식별)

원소 스키마에 `requiresHoldingMin3y` 메타필드 추가:

```js
{
  idx:                    number,     // 1~9
  lowerBound:             number,     // 거주연수 하한 (포함, 단위: 년)
  upperBound:             number,     // 정수 또는 Infinity (9행만)
  rate:                   number,     // 0.08, 0.12, ..., 0.40
  requiresHoldingMin3y:   boolean,    // "보유 3년 이상" 단서 적용 행
  label:                  string
}
```

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

> **단서 행 `idx=1` (거주 2~3년 미만 8%)은 보유 3년 이상에서만 활성**. 거주공제율 표 전 행이 시행령 제95조 ② 표 2 우측 본문상 "보유 3년 이상" 단서 적용 대상이므로 모두 `requiresHoldingMin3y: true`. 표 2 우측은 거주공제율이며 **2년부터 시작**(좌측 보유공제율은 3년부터). 표 2 자체가 1세대1주택 + 12억 초과(`isHighValueHouse`) 케이스에서만 호출되어 호출 시점에 보유 3년 이상이 거의 충족되나, `findResidenceRate`는 방어적으로 `holdingYears < 3` 시 0 반환 (§4-3-2).

### 3-4. HIGH_VALUE_HOUSE_THRESHOLD (v0.2 신규)

**근거**: 소득세법 제89조 제1항 제3호 단서 (시행령 제156조 ①).

```
HIGH_VALUE_HOUSE_THRESHOLD = 1200000000  // 12억원
```

| 항목 | 내용 |
|---|---|
| 단위 | 원 (정수) |
| 의의 | 1세대1주택 비과세 적용 시 양도가액이 본 임계를 초과하면 고가주택 안분 진입 |
| 안분 산식 | `(salePrice − HIGH_VALUE_HOUSE_THRESHOLD) / salePrice` (시행령 제160조 ①, `tax_engine.js` §3-3에서 적용) |
| `tax_engine.js` 호출 | 단계 2 (`check1Se1HouseExemption`)·단계 3 (`calculateHighValuePortion`) |

### 3-5. NON_TAXABLE_HOLDING_MIN_YEARS / _RESIDENCE_MIN_YEARS (v0.2 신규)

**근거**: 소득세법 시행령 제154조 ①.

```
NON_TAXABLE_HOLDING_MIN_YEARS    = 2  // 보유 2년 이상 (전국 공통)
NON_TAXABLE_RESIDENCE_MIN_YEARS  = 2  // 거주 2년 이상 (취득시 조정대상지역 한정)
```

| 항목 | 내용 |
|---|---|
| 단위 | 년 (정수) |
| 보유 적용 | 모든 1세대1주택 비과세 후보. `saleDate >= addYearsAnchored(acquisitionDate, 2)` |
| 거주 적용 | `acquisitionRegulated === true` 케이스에 한정. `residenceMonths >= 24` |
| `tax_engine.js` 호출 | 단계 2 (`check1Se1HouseExemption`) |

> **단위 통일성**: 본 모듈은 `_MIN_YEARS` 단위로 노출. `tax_engine.js`는 24개월 비교를 `Math.floor(residenceMonths / 12) >= NON_TAXABLE_RESIDENCE_MIN_YEARS` 또는 `residenceMonths >= NON_TAXABLE_RESIDENCE_MIN_YEARS * 12` 형태로 구현. 본 모듈은 정수 연차 임계만 제공.

### 3-6. v0.1 계승 상수·메타데이터 상세

#### 3-6-1. 메타데이터

| 멤버 | 값 | 비고 |
|---|---|---|
| `RULE_VERSION` | `"v0.2.0-post-20260510"` | `taxResult.ruleVersion`에 그대로 기록. v0.1 → v0.2 갱신 |
| `APPLICABLE_SALE_DATE_FROM` | `"2026-05-10"` | 양도일이 이 날짜 이전이면 호출 측이 `OUT_OF_V01_SCOPE_DATE` issueFlag 발동 (이름은 v0.2에서도 잔존 유지) |

#### 3-6-2. LAW_REFS (v0.1 6종 + v0.2 신규 4종)

| 키 | 값 | v0.2 변경 |
|---|---|---|
| `incomeTaxAct` | `"소득세법 [법률 제21065호, 2026-01-02 시행]"` | 동일 |
| `incomeTaxEnforcement` | `"소득세법 시행령 [대통령령 제36129호, 2026-03-01 시행]"` | 동일 |
| `progressiveRate` | `"소득세법 제55조 제1항"` | 동일 |
| `transferTaxRate` | `"소득세법 제104조 제1항"` | 동일 |
| `basicDeduction` | `"소득세법 제103조"` | 동일 |
| `localIncomeTax` | `"지방세법 제103조의3"` | 동일 |
| **`nonTaxation1Se1House`** | `"소득세법 제89조 제1항 제3호, 시행령 제154조"` | **신규** |
| **`highValueHouse`** | `"소득세법 제95조 제3항, 시행령 제160조 제1항"` | **신규** |
| **`longTermDeductionTable1`** | `"소득세법 제95조 제2항 표 1, 시행령 제159조의3"` | **신규** |
| **`longTermDeductionTable2`** | `"소득세법 제95조 제2항 표 2, 시행령 제159조의4"` | **신규** |

#### 3-6-3. 금액·세율 상수 (v0.1 그대로)

| 멤버 | 값 | 단위 | 근거 |
|---|---|---|---|
| `BASIC_DEDUCTION_AMOUNT` | `2500000` | 원 (정수) | 소득세법 제103조 |
| `LOCAL_INCOME_TAX_RATE` | `0.1` | 비율 | 지방세법 제103조의3 |
| `SHORT_TERM_RATE_UNDER_1Y` | `0.7` | 비율 | 소득세법 제104조 ① 제3호 |
| `SHORT_TERM_RATE_UNDER_2Y` | `0.6` | 비율 | 소득세법 제104조 ① 제2호 |
| `UNREGISTERED_RATE` | `0.7` | 비율 | 소득세법 제104조 ① 제1호 |

#### 3-6-4. HOLDING_PERIOD_BOUNDARY_YEARS (v0.2 신규 — 정수 임계 명시화)

```
HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]
```

| 임계 | 의의 | 도입 |
|---|---|---|
| 1 | 단기세율 1년 미만/이상 분기 | v0.1 (묵시) → v0.2 명시화 |
| 2 | 단기세율 2년 미만/이상 + 1세대1주택 비과세 보유요건 + 거주요건 | v0.1 (묵시) + v0.2 추가 의의 |
| 3 | 장특공 표 1·표 2 시작 | **v0.2 신규** |
| 15 | 장특공 표 1 상한 (15년 이상 30% 클램프) | **v0.2 신규** |

§11-4 결정에 따라 본 임계는 **정수 연차 단위만 정의**. 일자 단위 ±3일 비교는 `tax_engine.js` 책임.

---

## 4. 헬퍼 함수 계약

### 4-1. findBracket(taxBase) — v0.1 계승

v0.1.1 §5 그대로. 변경 없음.

| 항목 | 내용 |
|---|---|
| 입력 | `taxBase: number` (원 단위 정수, ≥ 0, 유한) |
| 출력 | `PROGRESSIVE_BRACKETS`의 한 원소 (참조 반환) |
| 경계 처리 | 상한 "이하" 기준. `14,000,000` → 1구간, `14,000,001` → 2구간 |
| 예외 | 음수·비정수·NaN·Infinity·문자열·null·undefined → `Error` throw |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |

### 4-2. findHoldingRate(holdingYears, table) — v0.2 신규

장특공 표 1·표 2 좌측 공통 룩업 함수.

| 항목 | 내용 |
|---|---|
| 입력 | `holdingYears: number` (정수, ≥ 0), `table: object[]` (`LONG_TERM_DEDUCTION_TABLE_1` 또는 `LONG_TERM_DEDUCTION_TABLE_2_HOLDING`) |
| 출력 | `rate: number` (0 ≤ rate ≤ 표 최대 행 rate) |
| 부수효과 | 없음 (순수 함수). `table` 참조 보존 |
| 결정성 | 동일 입력 → 동일 출력 |

#### 4-2-1. 입력 검증 (실패 시 throw)

| 입력 | 결과 |
|---|---|
| `holdingYears`가 비정수·NaN·Infinity·문자열·null·undefined | `Error` throw |
| `holdingYears < 0` | `Error` throw |
| `table`이 배열이 아니거나 길이 0 | `Error` throw |

#### 4-2-2. 클램프 정책 (룩업 함수 내부 처리)

| 입력 | 반환값 |
|---|---|
| `holdingYears < table[0].lowerBound` (표 1·표 2 모두 3년 미만) | **0** (적용 없음) |
| `holdingYears >= table[table.length - 1].lowerBound` (표 1: 15년, 표 2 좌측: 10년) | **표 최대 행 rate** (클램프) |
| 그 외 | 해당 행 `rate` |

#### 4-2-3. sanity 케이스 (TC-006~010 회귀 보호 — selfTest §9에 포함)

| 입력 | 표 | 출력 | 출처 |
|---|---|---|---|
| `findHoldingRate(2, TABLE_1)` | 표 1 | `0` | 보유 < 3년 |
| `findHoldingRate(3, TABLE_1)` | 표 1 | `0.06` | 표 1 idx=1 |
| `findHoldingRate(5, TABLE_1)` | 표 1 | `0.10` | TC-010 (보유 5년 → 10%) |
| `findHoldingRate(12, TABLE_1)` | 표 1 | `0.24` | TC-008 (보유 12년 → 24%) |
| `findHoldingRate(20, TABLE_1)` | 표 1 | `0.30` | 15년 이상 클램프 |
| `findHoldingRate(8, TABLE_2_HOLDING)` | 표 2 좌측 | `0.32` | TC-007 (보유 8년 → 32%) |
| `findHoldingRate(10, TABLE_2_HOLDING)` | 표 2 좌측 | `0.40` | TC-009 (10년 이상 클램프) |
| `findHoldingRate(50, TABLE_2_HOLDING)` | 표 2 좌측 | `0.40` | 클램프 |

### 4-3. findResidenceRate(residenceYears, holdingYears, table) — v0.2 신규

장특공 표 2 우측 거주공제율 룩업 함수. 단서 행(`requiresHoldingMin3y`) 단속.

| 항목 | 내용 |
|---|---|
| 입력 | `residenceYears: number` (정수, ≥ 0), `holdingYears: number` (정수, ≥ 0), `table: object[]` (`LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`) |
| 출력 | `rate: number` (0 ≤ rate ≤ 0.40) |
| 부수효과 | 없음 (순수 함수) |
| 결정성 | 동일 입력 → 동일 출력 |

#### 4-3-1. 입력 검증 (실패 시 throw)

| 입력 | 결과 |
|---|---|
| `residenceYears`·`holdingYears` 중 하나라도 비정수·NaN·Infinity·문자열·null·undefined | `Error` throw |
| `residenceYears < 0` 또는 `holdingYears < 0` | `Error` throw |
| `table`이 배열이 아니거나 길이 0 | `Error` throw |

#### 4-3-2. 클램프·단서 정책 (함수 내부 처리)

| 조건 | 반환값 | 근거 |
|---|---|---|
| `holdingYears < 3` | **0** | 표 2 우측 전 행 단서 (보유 3년 이상 한정). 명세서 §5-3-3 |
| `residenceYears < 2` | **0** | 표 2 우측 최소 거주 2년 |
| `2 <= residenceYears < 3` 이고 `holdingYears >= 3` | **0.08** | 표 우측 idx=1 단서 행 |
| `residenceYears >= 10` | **0.40** | 클램프 (표 우측 idx=9) |
| 그 외 (3 ≤ residenceYears < 10) | 해당 행 `rate` | 룩업 |

#### 4-3-3. sanity 케이스 (TC-007·009 회귀 보호 + 단서·클램프)

| 입력 | 출력 | 의의 |
|---|---|---|
| `findResidenceRate(0, 8, TABLE)` | `0` | 거주 0년 |
| `findResidenceRate(2, 2, TABLE)` | `0` | 보유 < 3년 단서 |
| `findResidenceRate(2, 5, TABLE)` | `0.08` | 단서 행 활성 |
| `findResidenceRate(5, 5, TABLE)` | `0.20` | 표 2 우측 idx=4 |
| `findResidenceRate(8, 8, TABLE)` | `0.32` | TC-007 (거주 8년 → 32%) |
| `findResidenceRate(10, 10, TABLE)` | `0.40` | TC-009 (10년 이상 클램프) |
| `findResidenceRate(50, 50, TABLE)` | `0.40` | 클램프 |

---

## 5. 입력 검증 패턴

본 모듈의 모든 룩업 함수는 동일한 입력 검증 패턴을 따른다.

### 5-1. 공통 검증 절차

1. 첫 번째 검증: 타입·유한성. `Number.isInteger(x) && Number.isFinite(x)` 위반 시 throw.
2. 두 번째 검증: 음수 차단. `x < 0` 위반 시 throw.
3. 세 번째 검증: 표 인자 유효성 (`findHoldingRate`·`findResidenceRate`만). `Array.isArray(table) && table.length > 0` 위반 시 throw.
4. 검증 통과 후 클램프 정책 적용 (§6).

### 5-2. 에러 메시지 규약

`Error` throw 시 메시지는 다음 형식을 권고:

```
'tax_rules.{함수명}: {파라미터명} must be a non-negative integer, got: {value}'
'tax_rules.{함수명}: table must be a non-empty array'
```

> 코드 본문 작성은 작업지시서 03이 결정. 본 모듈 스펙은 메시지 형식 권고만 명시.

### 5-3. 호출 측 처리

호출 측(`tax_engine.js`)은 본 모듈의 throw를 catch하지 않고 상위로 전파한다. 입력 정규화는 `validateCaseData(caseData)` 단계 0에서 미리 수행되어야 한다 (`input_collector.js` 책임).

---

## 6. 클램프 처리

### 6-1. 룩업 함수 클램프 정책 일람

| 함수 | 입력 범위 | 클램프 정책 |
|---|---|---|
| `findBracket` | `taxBase >= 0` | 8구간 `Infinity` 자연 처리 |
| `findHoldingRate(_, TABLE_1)` | 0 ≤ holdingYears | < 3 → 0, ≥ 15 → 0.30 |
| `findHoldingRate(_, TABLE_2_HOLDING)` | 0 ≤ holdingYears | < 3 → 0, ≥ 10 → 0.40 |
| `findResidenceRate(_, _, TABLE_2_RESIDENCE)` | 0 ≤ residenceYears, 0 ≤ holdingYears | holdingYears < 3 → 0, residenceYears < 2 → 0, 2~3 단서 → 0.08 (보유 3년 이상에서만), ≥ 10 → 0.40 |

### 6-2. 호출 측 클램프 미적용 원칙

`tax_engine.js`는 본 함수의 클램프 결과를 **그대로 사용**한다. `tax_engine.js`가 클램프 정책을 별도로 적용하지 않는다 (§0-1 원칙 (3) 산식 흐름 분리).

---

## 7. 시행일 기반 분기 (향후 v0.5+ 확장 준비)

v0.2는 단일 시행일(2026-05-10) 후속 적용 규칙만 노출. 향후 법령 개정에 따른 시행일별 다중 규칙 보유가 필요한 경우, 다음 패턴 적용 검토:

```
// 향후 v0.5+ 검토용 패턴 (v0.2 미적용)
findRulesByDate(saleDate):
  if saleDate >= "2027-01-01" → return RULES_2027
  if saleDate >= "2026-05-10" → return RULES_2026_05_10
  else → throw 'saleDate < APPLICABLE_SALE_DATE_FROM'
```

v0.2에서는 단일 규칙 세트만 노출. 호출 측 `tax_engine.js`는 `saleDate < APPLICABLE_SALE_DATE_FROM`이면 `OUT_OF_V01_SCOPE_DATE` issueFlag 발동 후 결과 산출 진행 (현행 동작 유지).

본 패턴 채택 시점은 백로그 B-021 (법제처 OpenAPI 활용 검토)와 함께 판단.

---

## 8. 의존성 (호출 측과의 read-only 관계)

### 8-1. 외부 의존

§1-4 참조. 외부 라이브러리·다른 TaxOpt 모듈·DOM 의존 없음.

### 8-2. `tax_engine.js` v0.2의 본 모듈 사용 항목

본 모듈은 `tax_engine.js`에 read-only로만 노출된다. `tax_engine.js`는 다음 항목을 본 모듈에서 읽는다:

| `tax_engine.js` 단계 | 본 모듈 사용 항목 |
|---|---|
| 단계 0 (validateCaseData) | — (자체 검증) |
| 단계 2 (1세대1주택 비과세) | `HIGH_VALUE_HOUSE_THRESHOLD`, `NON_TAXABLE_HOLDING_MIN_YEARS`, `NON_TAXABLE_RESIDENCE_MIN_YEARS` |
| 단계 3 (고가주택 안분) | `HIGH_VALUE_HOUSE_THRESHOLD` |
| 단계 4 (장특공) | `LONG_TERM_DEDUCTION_TABLE_1`, `LONG_TERM_DEDUCTION_TABLE_2_HOLDING`, `LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE`, `findHoldingRate`, `findResidenceRate` |
| 단계 6 (기본공제) | `BASIC_DEDUCTION_AMOUNT` |
| 단계 9~10 (세율·산출세액) | `PROGRESSIVE_BRACKETS`, `findBracket`, `SHORT_TERM_RATE_UNDER_1Y`, `SHORT_TERM_RATE_UNDER_2Y` |
| 단계 11 (지방소득세) | `LOCAL_INCOME_TAX_RATE` |
| issueFlag 수집 | `APPLICABLE_SALE_DATE_FROM`, `HOLDING_PERIOD_BOUNDARY_YEARS`, `LAW_REFS` |
| 결과 객체 메타 | `RULE_VERSION`, `LAW_REFS` |
| 부트스트랩 | `selfTest()` |

> `tax_engine.js`는 본 모듈의 객체를 변경하지 않는다 (§10 코드 작성 원칙).

### 8-3. 부트스트랩 가드 (호출 측)

`tax_engine.js` v0.2는 본 모듈 로드 후 다음 가드를 수행한다 (`tax_engine.md` v0.2.1 §8-2-1):

```
[가드 1] tax_rules selfTest 통과 확인
  st = window.TaxOpt.taxRules.selfTest()
  if not st.ok → throw 'tax_rules selfTest failed'

[가드 2] v0.2 신규 멤버 노출 확인
  if not LONG_TERM_DEDUCTION_TABLE_1 or not findHoldingRate
     → throw 'tax_engine v0.2: tax_rules v0.2 미로드'
```

본 모듈은 가드 대상 멤버를 누락 없이 노출할 책임을 진다.

---

## 9. selfTest 검증 케이스 (v0.2 신규 추가분)

### 9-1. selfTest 결과 구조

```
selfTest() => {
  ok: boolean,                              // 6종 모두 ok이면 true
  continuity:           { ok, checks },     // v0.1 (PROGRESSIVE_BRACKETS 7개 등식)
  integers:             { ok, fails },      // v0.1 (baseTax 8개 정수)
  monotonic:            { ok, fails },      // v0.1 (lowerBound·marginalRate·baseTax 단조성)
  longTermLookups: {                        // v0.2 신규 통합 검증
    ok:                       boolean,
    table1Fails:              Array,        // 표 1 sanity 5건
    table2HoldingFails:       Array,        // 표 2 좌측 sanity 3건
    table2ResidenceFails:     Array         // 표 2 우측 sanity 7건
  }
}
```

### 9-2. v0.1 자체검증 함수 (계승)

`verifyProgressiveContinuity()`, `verifyBaseTaxAreIntegers()`, `verifyMonotonic()` — v0.1.1 §6 그대로. 변경 없음.

### 9-3. verifyLongTermLookups() (v0.2 신규)

| 항목 | 내용 |
|---|---|
| 출력 | `{ ok: boolean, table1Fails: Array, table2HoldingFails: Array, table2ResidenceFails: Array }` |
| 검증 내용 | §4-2-3 (표 1 5건 + 표 2 좌측 3건) + §4-3-3 (표 2 우측 7건) sanity 케이스 룩업 결과가 expected 일치 여부 |
| 부수효과 | 없음 |
| 호출 권장 | `selfTest()` 내부 1회 호출 |

### 9-4. 호출 측 부트스트랩 가드

§8-3 참조. `selfTest()` 결과의 `ok === false`이면 호출 측이 `Error` throw하여 결과 산출을 차단한다.

---

## 10. 코드 작성 시 원칙

### 10-1. 본 모듈의 단일 책임

본 모듈은 **법령 명시 숫자·표·임계의 단일 보유자**다.

1. 법령 표(누진세율표·장특공 표 1·표 2)를 룩업 테이블 형태로 보유.
2. 룩업 함수(`findBracket`·`findHoldingRate`·`findResidenceRate`)를 노출.
3. 임계 상수(`HIGH_VALUE_HOUSE_THRESHOLD`·`BASIC_DEDUCTION_AMOUNT` 등)를 노출.
4. 메타데이터(`RULE_VERSION`·`LAW_REFS`·`APPLICABLE_SALE_DATE_FROM`)를 노출.
5. 자체검증 함수(`selfTest` 등)를 노출.

### 10-2. 본 모듈이 하지 않는 것

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

### 10-3. 함수 작성 원칙

1. 모든 룩업 함수는 **순수 함수** (부수효과 없음, 입력 변경 없음, 결정적).
2. 모든 룩업 함수는 입력 검증 수행 후 비정수·음수·NaN·Infinity·문자열·null·undefined에 대해 `Error` throw.
3. 모든 룩업 함수는 클램프 정책을 함수 내부에서 처리. 호출 측이 클램프를 다시 적용하지 않는다.
4. 룩업 결과를 호출 측이 산식으로 보강하지 않는다 (§0-1 원칙 (2)·(3)).

### 10-4. 자료 작성 원칙

1. 룩업 테이블은 **시행령 본문 그대로** 행 단위 보유. 등차수열 산식 표기 금지.
2. 룩업 테이블 각 행은 `lowerBound`·`upperBound`·`rate`·`label` 명시.
3. 단서 행(거주 표 idx=1)은 `requiresHoldingMin3y` 메타필드로 표시.
4. 모든 금액 상수는 원 단위 정수.

---

## 11. 미확정 항목 처리

### 11-1. tax_rules.js v0.2의 노출 형태 — 자동 해소

**배경**: 작업 창 #6 v0.2.0 명세서 §11이 "장특공 표를 배열로 보유할 것인가, 함수로 보유할 것인가"를 보류 항목으로 남겼다.

**해소 결과**: **작업 창 #6 v0.2.1 정정에서 룩업 정본 확정**으로 자동 해소되었다 (명세서 §0-1, tax_engine.md §8-1).

| 결정 사항 | 정본 |
|---|---|
| 노출 형태 | **룩업 테이블 + 룩업 함수** 양쪽 모두 노출 |
| 룩업 테이블 | `LONG_TERM_DEDUCTION_TABLE_1`·`_2_HOLDING`·`_2_RESIDENCE` (`object[]`) |
| 룩업 함수 | `findHoldingRate`·`findResidenceRate` (table을 인자로 받음) |
| 산식 형태 | **금지** (§0-1 원칙 (2)) |

본 모듈 스펙은 위 정본을 §3·§4에 그대로 반영하며 추가 결정 사항 없음.

### 11-2. selfTest sanity 케이스 (v0.2 추가) — 채택

**배경**: tax_engine.md §11-2가 "부트스트랩 부담 검토 후 채택 여부 결정"으로 보류.

**결정**: **채택**.

**근거**:
1. v0.1 selfTest는 부트스트랩 1회 호출(누진세율표 7개 등식 + 8개 정수 + 단조성 6건)로 수밀리초 부담. v0.2 추가 sanity 15건(표 1: 5 + 표 2 좌측: 3 + 표 2 우측: 7)은 단순 룩업이라 부담 거의 무시 가능.
2. TC-006~010 검증 통과 결과(KPI 100%)의 회귀 보호 가치 큼. 룩업 테이블 한 행만 잘못 들어가도 5건 중 1건 이상 즉시 깨짐. 한 줄 오타 회귀를 부트스트랩 시점에서 차단하는 가치가 부담을 상회.
3. v0.1 selfTest 패턴(`ok` 반환, throw 없음)과 동일하므로 호출 측 변경 불필요.

**구현 범위**:
- §4-2-3 (`findHoldingRate` sanity 8건 — 표 1 5건 + 표 2 좌측 3건)
- §4-3-3 (`findResidenceRate` sanity 7건 — 표 2 우측)
- §9-3 `verifyLongTermLookups()` 함수로 통합 검증
- **TC 전체 산출(`calculateSingleTransfer` 호출)은 selfTest에 포함 금지** — 그것은 `tests/tax_engine.test.js`의 책임

### 11-3. Object.freeze 적용 여부 — 미적용 (v0.1 정책 계승)

**배경**: tax_engine.md §11-3가 "v0.3 시나리오 엔진 도입 시 모듈 격리 요구 여부에 따라 결정"으로 보류.

**결정**: **v0.2 미적용**. v0.3 시나리오 엔진 도입 시 재검토.

**근거**:
1. v0.1.1 §7이 "본 모듈은 `Object.freeze`를 적용하지 않는다(v0.1)"로 명시. 정책 일관성 유지.
2. v0.2는 시나리오 엔진 미도입 → 다중 모듈이 동시에 본 모듈을 변경할 위험 없음. 단일 호출자(`tax_engine.js`)는 §10-2 계약을 준수하여 객체를 변경하지 않는다.
3. `Object.freeze`는 nested 객체에 자동 적용되지 않으므로 `PROGRESSIVE_BRACKETS`·룩업 테이블 같은 배열은 deep-freeze 별도 구현이 필요. 부담 vs 효용 v0.2 시점에서 효용 부족.
4. v0.3 시나리오 엔진 도입 시 **다중 시나리오가 동일 룩업 테이블을 공유**할 때 mutation 보호 가치가 의미 있어짐. 그때 deep-freeze 적용 여부 별도 결정.

**대안**: 본 모듈은 IIFE로 감싸 외부 직접 접근을 어렵게 하는 v0.1 패턴 유지.

### 11-4. HOLDING_PERIOD_BOUNDARY 임계 확장 — 정수 임계만 본 모듈에 정의

**배경**: tax_engine.md §11-4가 "정수 임계 외에 일자 단위 임계도 필요한지(±3일은 일자 기준)는 검증팀 의견 수렴 후 결정"으로 보류.

**결정**:
- **본 모듈**: 정수 연차 임계 배열 `HOLDING_PERIOD_BOUNDARY_YEARS = [1, 2, 3, 15]` 노출 (§3-6-4).
- **`tax_engine.js`**: 일자 단위 ±3일 비교는 `addYearsAnchored(acquisitionDate, n)` + `Math.abs((saleDate − mark) in days) <= 3` 형태로 처리. 임계 정수는 본 모듈에서 가져오되 일자 산정·비교 자체는 `tax_engine.js` 책임.

**근거**:
1. **§0-1 원칙 (3) 산식 흐름 분리**: 일자 비교는 입력(`acquisitionDate`·`saleDate`) 의존이므로 데이터 모듈인 본 모듈의 책임 범위 밖.
2. **명세서 §6-3**: "1년/2년/3년/15년 마크의 ±3일"은 `tax_engine.js`의 `collectIssueFlags`가 평가하는 issueFlag 발동 조건. 본 모듈은 임계 정수만 제공하면 충분.
3. **테스트 분리 가능**: 본 모듈 테스트(`tests/tax_rules.test.js`)는 정수 배열 검증만 수행. 일자 단위 ±3일 테스트는 `tests/tax_engine.test.js`의 책임. 모듈별 테스트 격리 유지.

**작업지시서 04 (tax_engine v0.2)에서 결정할 사항**: `addYearsAnchored` 호출 위치, 일자 차이 계산 헬퍼 함수 위치(`tax_engine.js` 내부 utility 또는 별도 모듈).

### 11-5. UNREGISTERED_ASSET 이름 통일 — `UNREGISTERED_RATE` 유지

**배경**: tax_engine.md §11-5가 "`UNREGISTERED_ASSET_ASSUMED_FALSE` → `UNREGISTERED_RATE_NOT_APPLIED` 이름 변경" 보류. 본 모듈에서는 노출 멤버명도 함께 결정 필요.

**결정**: **본 모듈의 노출 멤버명 `UNREGISTERED_RATE`는 v0.1 그대로 유지**.

**근거**:
1. **v0.1 회귀 안전성**: `UNREGISTERED_RATE` 멤버를 v0.1.1에서 노출하고 있으며 `tests/tax_rules.test.js`도 이 이름으로 검증. 이름 변경 시 v0.1 회귀 위험.
2. **세율(rate) vs 자산(asset) 명명 정합성**: 본 모듈은 다른 세율 상수 `SHORT_TERM_RATE_UNDER_1Y`·`LOCAL_INCOME_TAX_RATE` 등 모두 `_RATE` 접미사. `UNREGISTERED_RATE`가 이 패턴과 일치.
3. **issueFlag 코드명은 별개 사안**: `UNREGISTERED_ASSET_ASSUMED_FALSE` → `UNREGISTERED_RATE_NOT_APPLIED` 이름 변경은 `tax_engine.js`의 `collectIssueFlags` 책임이며 본 모듈 노출 멤버명과 분리. 이는 작업지시서 04 (tax_engine v0.2)에서 결정.

**작업지시서 04에서 결정할 사항**: issueFlag 코드명 변경의 회귀 영향(`tests/tax_engine.test.js`의 issueFlag 발동 검증). v0.1 issueFlag 검증 케이스가 있으면 이름 변경 시 함께 갱신 필요.

### 11-6. 향후 v0.3+ 인계 항목

본 모듈 스펙 작성 중 발견한, v0.3 이후 본 모듈 갱신이 필요한 항목을 추적용으로 명시한다.

| ID | 항목 | 인계 시점 | 비고 |
|---|---|---|---|
| TR-01 | 다주택 중과 세율표 (제104조 ⑦) | v0.3 | `MULTI_HOUSE_HEAVY_RATE_BRACKETS` 신규 룩업 테이블 추가 예정. 2주택·3주택 중과 분기 |
| TR-02 | 일시적 2주택 비과세 임계 (시행령 제155조 ①) | v0.3 또는 v0.5 | 신규 임계 (구주택 처분 기한 등) 룩업화 |
| TR-03 | Object.freeze deep-freeze 적용 검토 | v0.3 | §11-3 결정 재검토. 시나리오 엔진 도입 시 다중 시나리오 공유 보호 |
| TR-04 | 시행일별 다중 규칙 보유 (`findRulesByDate`) | v0.5+ | §7 패턴 채택. 법제처 OpenAPI 자동 갱신 (B-021) 도입 시 |
| TR-05 | 상속·증여 취득가액 산정 룰 (시행령 제163조) | v0.5+ | 매매취득 외 케이스 도입 시 |
| TR-06 | 공익사업 수용 등 거주요건 면제 사유 (시행령 제154조 ① 단서) | v0.4+ | `RESIDENCE_EXEMPTION_REASONS` 룩업 테이블 신규 |
| TR-07 | 미등기 → 등기 갱신·자산별 미등기 세율 차이 | v0.5+ | 현 `UNREGISTERED_RATE` 단일값을 자산별 룩업으로 확장 가능성 |
| TR-08 | 부칙·경과규정 본격 반영 (취득시기·계약시기 기준 종전규정) | v0.5+ | B-023 추적. 발표 데모 케이스는 부칙 영향 회피 (B-018, 5/1 결정 (라)+(가)). RULE_SETS 구조 + contractDate 입력 필드 추가 |

> 본 표는 본 모듈 스펙 작성 중 발견한 v0.3+ 영향 항목. 각 항목은 백로그(B-024 등)에 별도 등록 예정.
>
> TR-08은 B-023과 직접 연계. v0.5+ 단계에서 B-021 (법제처 OpenAPI 활용)과 B-020 (의사결정 #5 강화 — 법령 개정 대응 아키텍처)와 함께 통합 처리.

---

## 12. 작업지시서 03 입력 패키지 (Claude Code에 전달할 핵심 요약)

작업 창 #8(작업지시서 03 작성)에 본 모듈 스펙과 함께 전달할 핵심 요약. Claude Code가 .js 작성 시 single source.

### 12-1. 핵심 결정 요약

| 항목 | 결정 |
|---|---|
| 노출 객체 | `window.TaxOpt.taxRules` (IIFE, ES6 module 미사용) |
| 노출 멤버 | 24종 (v0.1 17 + v0.2 신규 7) |
| 룩업 테이블 | 4종 — `PROGRESSIVE_BRACKETS`(8) + `LONG_TERM_DEDUCTION_TABLE_1`(13) + `_TABLE_2_HOLDING`(8) + `_TABLE_2_RESIDENCE`(9) |
| 룩업 함수 | 3종 — `findBracket` + `findHoldingRate` + `findResidenceRate` |
| 입력 검증 | 모든 룩업 함수 비정수·음수·NaN·Infinity·문자열·null·undefined throw |
| 클램프 정책 | 룩업 함수 내부 처리 (호출 측 클램프 미적용) |
| `Object.freeze` | 미적용 (§11-3) |
| `selfTest` | v0.1 3종 + v0.2 신규 1종(`verifyLongTermLookups`) 통합 |
| 미등기 멤버명 | `UNREGISTERED_RATE` 유지 (§11-5) |

### 12-2. v0.1 → v0.2 패치 변경 요약

1. `RULE_VERSION` 갱신: `"v0.1.1-post-20260510"` → `"v0.2.0-post-20260510"`
2. `LAW_REFS`에 v0.2 신규 4키 추가
3. 신규 상수 3종: `HIGH_VALUE_HOUSE_THRESHOLD`, `NON_TAXABLE_HOLDING_MIN_YEARS`, `NON_TAXABLE_RESIDENCE_MIN_YEARS`
4. 신규 룩업 테이블 3종: §3-2·§3-3
5. 신규 임계 배열 1종: `HOLDING_PERIOD_BOUNDARY_YEARS`
6. 신규 룩업 함수 2종: `findHoldingRate`, `findResidenceRate`
7. 신규 자체검증 함수 1종: `verifyLongTermLookups`
8. `selfTest()` 결과 객체에 `longTermLookups` 필드 추가
9. v0.1 멤버 17종 시그니처·값 모두 그대로 유지

### 12-3. 회귀 안전성 보장 항목 (v0.1 → v0.2 패치 후)

1. v0.1 selfTest 결과 `ok === true` (장특공 sanity 추가만, 기존 검증 무영향)
2. v0.1 노출 17종 멤버 모두 그대로 접근 가능
3. v0.1 골든셋 TC-001~005가 v0.2 패치 후 그대로 통과 (입력 패치 `householdHouseCount: 2` 추가는 별건, `tax_engine.js` 단계에서 검증)

### 12-4. 신규 검증 안전성 보장 항목 (v0.2 신규)

1. `findHoldingRate(12, TABLE_1) === 0.24` (TC-008 회귀)
2. `findHoldingRate(5, TABLE_1) === 0.10` (TC-010 회귀)
3. `findHoldingRate(8, TABLE_2_HOLDING) === 0.32` (TC-007 회귀)
4. `findHoldingRate(10, TABLE_2_HOLDING) === 0.40` (TC-009 클램프 회귀)
5. `findResidenceRate(8, 8, TABLE_2_RESIDENCE) === 0.32` (TC-007 회귀)
6. `findResidenceRate(10, 10, TABLE_2_RESIDENCE) === 0.40` (TC-009 클램프 회귀)
7. `findResidenceRate(2, 5, TABLE_2_RESIDENCE) === 0.08` (단서 행 활성)
8. `findResidenceRate(2, 2, TABLE_2_RESIDENCE) === 0` (보유 < 3년 단서 차단)
9. `HIGH_VALUE_HOUSE_THRESHOLD === 1200000000`
10. `RULE_VERSION === "v0.2.0-post-20260510"`

---

## 13. 검증 체크리스트

본 모듈 스펙 작성 후, 그리고 작업지시서 03 산출 후, Claude Code 산출 .js 검증 시 사용.

### 13-1. 모듈 스펙 자체 (본 문서) 체크

- [ ] §3 4개 룩업 테이블이 시행령 본문 그대로 (산식 표기 없음)
- [ ] §3-3-1 표 2 좌측 8행, §3-3-2 표 2 우측 9행, §3-2-2 표 1 13행
- [ ] §3-3-2 표 2 우측 idx=1 행에 `requiresHoldingMin3y: true` 명시
- [ ] §4 3개 헬퍼 함수 시그니처·입력 검증·클램프 정책·sanity 케이스 명시
- [ ] §11 보류 항목 4건(§11-2~5) 결정 결과 + 근거 명시
- [ ] §11-1 자동 해소 + §11-6 v0.3+ 인계 명시
- [ ] §0-1 법령 개정 대응 아키텍처 인용 (§1-2)
- [ ] v0.1 회귀 안전성 보장 항목 명시 (§12-3)

### 13-2. Claude Code 산출 `js/tax_rules.js` 체크

- [ ] `window.TaxOpt.taxRules` 노출 객체 24종 멤버 모두 정의
- [ ] `RULE_VERSION === "v0.2.0-post-20260510"`
- [ ] 4개 룩업 테이블 행 수 (8 + 13 + 8 + 9) 일치
- [ ] 표 2 우측 idx=1 `requiresHoldingMin3y === true`
- [ ] 3개 헬퍼 함수 입력 검증 throw 동작
- [ ] 클램프 정책 함수 내부 처리
- [ ] `selfTest()` 6종 검증 통과 (`ok === true`)
- [ ] `Object.freeze` 미적용
- [ ] `UNREGISTERED_RATE` 유지

### 13-3. Claude Code 산출 `tests/tax_rules.test.js` 체크

- [ ] v0.1 회귀 검증 그대로 통과 (Node.js 67/0 → v0.2 추가 후 N/0)
- [ ] §12-4 신규 검증 항목 10건 모두 통과
- [ ] `selfTest()` 결과 `longTermLookups.ok === true`

### 13-4. v0.2 골든셋 회귀 (작업지시서 04 단계 — 본 모듈 스펙 검증 후)

- [ ] TC-006~010 5건 totalTax 일치 (`tests/tax_engine.test.js`)
- [ ] TC-001~005 5건 totalTax 일치 (입력 패치 `householdHouseCount: 2` 적용 후)

---

## 14. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.2.0 | 2026-05-01 | 초기 작성. v0.1.1 modules/tax_rules.md (235줄) 베이스 + v0.2 신규 항목. (1) §1-2 §0-1 법령 개정 대응 아키텍처 인용. (2) §3 룩업 테이블 4종 정본 (PROGRESSIVE_BRACKETS 계승 + 장특공 표 1·2 좌·2 우 신규). (3) §4 헬퍼 함수 3종 (findBracket 계승 + findHoldingRate·findResidenceRate 신규). (4) §11 보류 항목 4건 결정: §11-2 selfTest sanity 채택, §11-3 Object.freeze 미적용, §11-4 HOLDING_PERIOD_BOUNDARY 정수 임계만 본 모듈, §11-5 UNREGISTERED_RATE 이름 유지. (5) §11-1 자동 해소 + §11-6 v0.3+ 인계 7건. (6) §12 작업지시서 03 입력 패키지. (7) §13 검증 체크리스트. (8) 5/1 보강 정정: §11-6 TR-08 (B-023 부칙·경과규정) 추가 + 백로그 ID 매핑 정정 (상단 메타 + §11-2·§11-3 추적 표기). |

---

본 문서는 v0.2 명세서가 변경되지 않는 한 함께 변경되지 않는다. v0.3에서 다주택 중과 세율표가 추가되면 별도로 `docs/v0.3/modules/tax_rules.md`를 작성하거나 본 문서를 v0.3으로 갱신한다.

(끝)
