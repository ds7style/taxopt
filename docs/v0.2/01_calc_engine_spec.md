# TaxOpt 계산 엔진 명세서 v0.2.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.2/01_calc_engine_spec.md` |
| 버전 | v0.2.1 (검증 통과 + 산식 표기 정정) |
| 상태 | ✅ **검증 완료** (검증팀 손계산 + 홈택스 모의계산 3자 일치, 2026-04-30, KPI 100%) |
| 검증 방식 | 검증팀 손계산(설하영·이준기·김태환·김두섭) + 국세청 홈택스 모의계산 3자 일치 |
| 검증 결과 | TC-006~010 5건 totalTax 일치 (TC-006 0 / TC-007 6,161,100 / TC-008 130,878,000 / TC-009 1,383,642 / TC-010 122,826,000) |
| 작성일 | 2026-04-30 (v0.2.0 초안) → 2026-05-01 (v0.2.1 정정) |
| 적용 법령 | 소득세법 [법률 제21065호, 시행 2026-01-02] / 시행령 [대통령령 제36129호, 시행 2026-03-01] |
| 적용 전제 | 양도일 ≥ 2026-05-10 (중과 유예 종료 후), 양도시 비조정대상지역, 취득시 조정대상지역 입력 활성, 거주자, 단독명의, 매매취득, 등기자산 |
| 다음 버전 | v0.3 (다주택 중과·시나리오 엔진 추가 예정) |
| 의사결정 준수 | #2 (v0.2 범위), #5 강화 (법령 개정 대응 아키텍처 — §0-1), #9 v9 (.js 코드 산출 금지), #10 (입력 스키마 v0.1.2 패치 활용) |
| 백로그 추적 | B-020 (장특공 산식 → 룩업 테이블 통일), B-021 (법제처 OpenAPI 활용 검토) |

---

## 0. v0.1 → v0.2 변경 요약

v0.2는 v0.1.1의 13단계 파이프라인 골격을 그대로 유지하면서 **3·4·5단계의 passthrough를 활성화**한다. 1·5·6·7·8·9·10·11·12·13단계 본문은 변경 없음. 따라서 **TC-001~005는 그대로 회귀 통과해야** 한다(§9 회귀 원칙).

| 단계 | v0.1.1 동작 | v0.2.0 동작 |
|---|---|---|
| 0 | validateCaseData (8개 필드) | 활성 필드 추가(`residenceMonths`, `livingNow`, `acquisitionRegulated`, `householdHouseCount`, `isOneTimeTwoHouses`) + 자동 보정 룰(§7-3) |
| 1 | `transferGain = salePrice − acquisitionPrice − necessaryExpense` | 동일 |
| 2 | passthrough (`taxableGain = transferGain`) | **활성**: 1세대1주택 비과세 판정 (§3) |
| 3 | passthrough (`taxableGain` 유지) | **활성**: 12억 초과 고가주택 안분 (§4) |
| 4 | `longTermDeduction = 0` | **활성**: 표 1·표 2 분기 적용 (§5) |
| 5~13 | 명세서 v0.1.1 §2 그대로 | 동일 (변경 없음) |

> **인터페이스 약속**: 13단계 함수 시그니처는 v0.1.1과 동일하게 유지. 함수 본문만 활성화. v0.3에서는 8·9단계(다주택 중과 세율 분기)가 추가 활성화될 예정.

---

## 0-1. 법령 개정 대응 아키텍처 (의사결정 #5 강화 — v0.2.1 신설)

본 명세서가 정의하는 모든 **법령 명시 숫자**(임계 금액·세율·공제액·공제율 표·연차 분기 임계)는 다음 3가지 원칙을 따른다. 본 원칙은 v0.2.1 정정 시 **검증팀 4/30 피드백을 반영하여 채택**되었으며, 백로그 B-020으로 추적한다.

| 원칙 | 내용 | 위배 시 결과 |
|---|---|---|
| (1) **단일 소스** | 법령 명시 숫자는 모두 `tax_rules.js` 단일 모듈에 둔다. `tax_engine.js`·`scenario_engine.js`·`input_collector.js` 등 어느 다른 모듈도 법령 숫자를 직접 보유하지 않는다. | 법령 개정 시 수정 범위가 다중 모듈로 퍼져 회귀 위험 증가 |
| (2) **룩업 테이블 우선** | 법령 표(예: 장특공 표 1·표 2, 누진세율표)는 **반드시 표 그대로 룩업 테이블** 형태로 정의한다. `0.06 + (n−3) × 0.02` 같은 등차수열 산식이 표와 결과가 동치이더라도 **산식 형태는 금지**한다. | 법령 표가 등차수열이 아닌 비정형 행으로 개정되면 산식이 깨짐 (예: 거주공제율 표의 "보유 3년 이상 + 거주 2~3년 미만 8%" 같은 단서) |
| (3) **산식 흐름 분리** | `tax_engine.js`는 13단계 산식 **흐름**(파이프라인 호출 순서·분기 조건·절사·합계)만 담당한다. 숫자·표는 `tax_rules.js`의 룩업 함수(`findHoldingRate` 등)를 호출해 받는다. | 코드 본문에 매직 넘버가 산재하여 회귀 테스트 시 검증 포인트가 불명확 |

### 0-1-1. 적용 효과

- **법령 개정(세율·공제율·임계 변경) 시 `tax_rules.js`만 수정**한다. `tax_engine.js`는 수정하지 않는다.
- **`tax_engine.js` 수정은 새 단계·분기·산식 흐름이 추가될 때만** 발생한다 (예: v0.3 다주택 중과 분기 추가).
- 향후 법제처 OpenAPI 자동 갱신을 검토할 경우(백로그 B-021), 자동화 대상은 `tax_rules.js`로 한정된다.

### 0-1-2. v0.2.1에서 영향받는 영역

| 영역 | v0.2.0 표기 | v0.2.1 표기 |
|---|---|---|
| §5-2 표 1 산식 | `0.06 + (h−3) × 0.02` (등차수열 산식) | **표 1 룩업 테이블** + `findHoldingRate(h, TABLE_1)` 함수 호출 |
| §5-3-3 표 2 보유공제율 | `holdingYears × 0.04` (등차수열 산식) | **표 2 보유공제율 룩업** + `findHoldingRate(h, TABLE_2_HOLDING)` |
| §5-3-3 표 2 거주공제율 | `residenceYears × 0.04` (등차수열 산식) | **표 2 거주공제율 룩업** + `findResidenceRate(r, h, TABLE_2_RESIDENCE)` |

### 0-1-3. 본 정정의 의미 (검증 결과 무영향)

본 정정은 **표기 통일**이며, 검증 완료된 TC-006~010의 산출 결과(totalTax 5건)는 **모두 그대로 보존**된다. 산식 산출과 룩업 산출은 모든 정수 연차에서 수학적으로 동치이며, 이는 회귀 테스트(`tax_engine.test.js`)가 향후 검증한다.

---

## 1. 적용 범위

### 1-1. v0.2 포함 (신규 활성)

- **1세대1주택 비과세 판정** (소득세법 제89조 ①ⅲ, 시행령 제154조)
  - 보유 ≥ 2년 (취득시 조정대상지역인 경우 거주 ≥ 2년 추가)
  - 12억 이하 → 전액 비과세 (totalTax = 0)
  - 12억 초과 → 고가주택 안분 진입
- **고가주택 12억 초과분 안분 과세** (소득세법 제95조 ③, 시행령 제160조 ①)
  - 안분비율 = (양도가액 − 12억) / 양도가액
- **장기보유특별공제 표 1·표 2** (소득세법 제95조 ② 표 1·표 2)
  - 표 1: 보유 3~15년 6%~30% (일반)
  - 표 2: 1세대1주택 (보유공제율 + 거주공제율 합산, 최대 80%)

### 1-2. v0.2 제외 (issueFlag로만 표시)

- 다주택 중과 (제104조 ⑦) — v0.3
- 시나리오 엔진 (어느 1채·순서·시점 비교) — v0.3 (의사결정 #10 적용)
- 일시적 2주택 특례 (시행령 제155조 ①) — issueFlag `ONE_TIME_2HOUSES_NOT_APPLIED`만 발동, 다주택 일반과세로 처리
- 미등기양도자산 70% 세율 — issueFlag `UNREGISTERED_RATE_NOT_APPLIED`, 등기 가정 유지
- 상속·증여·부담부증여 — 매매취득 가정 유지
- 조합원입주권·분양권, 부부공동명의, 임대주택 특례, 조특법 특례주택 — 미적용
- 보유기간 통산 (재건축·상속 동일세대) — 미적용
- 거주요건 면제 사유 (공익사업 수용 등 시행령 제154조 ① 단서) — issueFlag `RESIDENCE_EXEMPTION_NOT_HANDLED`(info)만

### 1-3. 적용 전제

| 전제 | v0.2 내용 | v0.1 대비 변경 |
|---|---|---|
| 양도일 | ≥ 2026-05-10 | 동일 |
| 양도 시 소재지 | 비조정대상지역 | 동일 (다주택 중과 미적용 → 양도시 입력 활성은 v0.3) |
| 취득 시 소재지 | **조정대상지역 입력 활성** (거주요건 판정용) | **변경**: v0.1 false 가정 → v0.2 입력값 사용 |
| 거주성 | 거주자 | 동일 |
| 명의 | 단독명의 | 동일 |
| 취득 원인 | 매매취득 | 동일 |
| 등기 여부 | 등기자산 | 동일 |
| 1세대 보유주택 수 | **입력 활성** (비과세 판정용) | **변경**: v0.1 후보 주택 수 추정 → v0.2 `householdHouseCount` 입력 우선 |

---

## 2. 계산 파이프라인 (13단계, v0.2 활성판)

| 단계 | 변수 | 계산식 | 근거 |
|---|---|---|---|
| 0 | — | `validateCaseData(caseData)` + 자동 보정 | — |
| 1 | `transferGain` | `salePrice − acquisitionPrice − necessaryExpense` | 제95조 ①, 제96조, 제97조 |
| 2 | `is1Se1House` | 1세대1주택 비과세 판정 (§3) | 제89조 ①ⅲ, 시행령 제154조 |
|   | `taxableGain` (비과세 후) | (a) 비과세 + 12억 이하 → **단계 2 종료** (totalTax=0). (b) 비과세 + 12억 초과 → 단계 3 진입. (c) 비과세 미해당 → `taxableGain = transferGain` | — |
| 3 | `taxableGain` (안분 후) | (b) 케이스 → `Math.floor(transferGain × (salePrice − 1,200,000,000) / salePrice)`. (c) 케이스 → `transferGain` | 제95조 ③, 시행령 제160조 ① |
|   | `allocationRatio` | `(salePrice − 1,200,000,000) / salePrice` (12억 초과·비과세 시), 그 외 `1.0` | 시행령 제160조 ① |
| 4 | `longTermDeduction` | 표 1·표 2 분기 적용 (§5). 보유 < 3년 → 0 | 제95조 ② 표 1·표 2 |
|   | `appliedDeductionTable` | `1` (표 1) / `2` (표 2) / `null` (적용 없음) | 제95조 ② 단서 |
| 5 | `capitalGainIncome` | `taxableGain − longTermDeduction` | 제95조 ① |
| 6 | `basicDeduction` | `basicDeductionUsed ? 0 : 2,500,000` | 제103조 |
| 7 | `taxBase` | `Math.max(0, capitalGainIncome − basicDeduction)` | 제92조 ③ |
| 8 | `holdingPeriodBranch` | 동월동일 비교 → `"under1y"` / `"under2y"` / `"over2y"` | 제95조 ④ |
| 9 | `appliedRate` | 8단계 분기에 따라 적용 세율·구간 결정 | 제104조 ①, 제55조 ① |
| 10 | `calculatedTax` | 9단계 세율을 7단계 과세표준에 적용 (`Math.floor`) | 제55조 ①, 제104조 ① |
| 11 | `localIncomeTax` | `Math.floor(calculatedTax × 0.1)` | 지방세법 제103조의3 |
| 12 | `totalTax` | `calculatedTax + localIncomeTax` | — |
| 13 | `netAfterTaxSaleAmount` | `salePrice − totalTax` | v0.1 정의 유지 |

> **단계 2 종료 시 동작**: `totalTax = 0`, `calculatedTax = 0`, `localIncomeTax = 0`, `taxBase = 0`, `longTermDeduction = 0`, `capitalGainIncome = 0`, `taxableGain = 0`을 명시 설정 후 13단계만 산출 (`netAfterTaxSaleAmount = salePrice`). 결과 객체 일관성 보장.

---

## 3. 1세대1주택 비과세 판정 (단계 2 상세)

### 3-1. 결정 트리

```
[start]
  │
  ├ householdHouseCount === 1 ?
  │   ├ NO  → is1Se1House=false, taxableGain = transferGain (단계 3 c 케이스)
  │   └ YES → 다음
  │
  ├ saleDate ≥ acquisitionDate + 2년 (동월동일) ?
  │   ├ NO  → is1Se1House=false (보유요건 미달)
  │   └ YES → 다음
  │
  ├ acquisitionRegulated === true ?
  │   ├ NO  → 거주요건 면제 → 비과세 적용 가능 → 다음
  │   └ YES → residenceMonths ≥ 24 ?
  │           ├ NO  → is1Se1House=false (거주요건 미달)
  │           │       + RESIDENCE_EXEMPTION_NOT_HANDLED issueFlag
  │           └ YES → 비과세 적용 가능 → 다음
  │
  ├ 비과세 적용 가능 → salePrice ≥ 1,200,000,000 ?
      ├ NO  → 전액 비과세 → 단계 2 종료
      │       (is1Se1House=true, isHighValueHouse=false, totalTax=0)
      └ YES → 안분 진입 → 단계 3 (a)
              (is1Se1House=true, isHighValueHouse=true)
```

### 3-2. 입출력

| 항목 | 입력 |
|---|---|
| `householdHouseCount` | 1세대 보유 주택 수 (정수, 누락 시 §7-3 자동 보정) |
| `acquisitionDate`, `saleDate` | ISO date |
| `acquisitionRegulated` | boolean (취득시 조정대상지역) |
| `residenceMonths` | 정수 ≥ 0 (개월) |
| `salePrice` | 정수 ≥ 1 |

| 출력 | 의미 |
|---|---|
| `is1Se1House` | 비과세 적용 여부 |
| `isHighValueHouse` | 12억 초과 안분 진입 여부 |
| `terminateAt2` | 단계 2 종료 여부 |
| `holdingYears` | 동월동일 비교 산출 정수 연차 |
| `residenceYears` | `Math.floor(residenceMonths / 12)` |

### 3-3. 보유기간·거주기간 산정

- 보유연수: 명세서 v0.1.1 §3 동월동일 비교 알고리즘. `addYearsAnchored(acquisitionDate, n)` 사용. 윤년 2/29 처리 동일.
- 비과세 보유요건: `saleDate >= addYearsAnchored(acquisitionDate, 2)`
- 거주요건: `residenceMonths >= 24` (사용자 입력값 신뢰)

### 3-4. 거주기간 입력 신뢰성

시행령 제154조 ⑥은 거주기간을 주민등록표 등본의 전입~전출 기간으로 정의한다. v0.2는 사용자 입력 `residenceMonths`(정수, 개월)를 그대로 신뢰하며, **항상 `RESIDENCE_MONTHS_USER_INPUT` (info) issueFlag**를 발동하여 산정 책임을 명시한다.

### 3-5. 거주요건 면제 (v0.2 단순화)

시행령 제154조 ① 단서의 면제 사유(공익사업 수용, 해외 이주, 1년 이상 해외거주 등)는 v0.2 미처리. 취득시 조정대상지역이고 거주 24개월 미만인 경우 `RESIDENCE_EXEMPTION_NOT_HANDLED`(info) issueFlag로 사용자 검토 권고.

---

## 4. 고가주택 안분 (단계 3 상세)

### 4-1. 발동 조건

- `is1Se1House === true` 이고 `salePrice >= 1,200,000,000`

> 다주택자(비과세 미적용)의 12억 초과 주택은 v0.2에서 안분하지 않고 양도차익 전체에 표 1을 적용한다. 다주택 12억 초과의 별도 처리는 v0.3 이후 결정.

### 4-2. 안분 산식 (시행령 제160조 ①)

```
allocationRatio = (salePrice − 1,200,000,000) / salePrice
taxableGain     = Math.floor(transferGain × allocationRatio)
```

### 4-3. 절사 정책

- `allocationRatio`: 비율이므로 **절사하지 않음** (JS Number 그대로).
- `taxableGain`: **`Math.floor`로 정수 변환**. 후속 모든 금액이 원 단위 정수이므로 안분 직후 정수화하여 부동소수점 누적 오차 차단.
- 검증팀 손계산은 정수 절사 후 값을 정답으로 인정.

> **장특공 안분 정합성**: 시행령 제160조 ①의 두 식(양도차익·장특공 모두 동일 비율 안분)을 v0.2는 단계 3에서 양도차익만 안분하고 단계 4에서 안분 후 양도차익에 표 2 공제율을 곱하는 형태로 구현. 수학적으로 동치(`(transferGain × ratio) × 공제율 = (transferGain × 공제율) × ratio`)이며 절사 위치만 단계 3 1회로 통일된다. 검증팀 손계산 시 동치 산식임을 명시한다.

### 4-4. 출력

| 변수 | 의미 |
|---|---|
| `taxableGain` | 안분 후 과세대상 양도차익 (정수) |
| `allocationRatio` | 안분비율 (Number, 결과 객체 메타) |
| `isHighValueHouse` | true |

---

## 5. 장기보유특별공제 (단계 4 상세)

### 5-1. 적용 표 결정

| 조건 | 적용 표 | `appliedDeductionTable` |
|---|---|---|
| `is1Se1House === true` (단계 3 안분 후) | 표 2 | `2` |
| `is1Se1House === false` 이고 보유 ≥ 3년 | 표 1 | `1` |
| 보유 < 3년 | 적용 없음 (`longTermDeduction = 0`) | `null` |

> **미등기양도자산·다주택 중과 대상 적용 배제 (제95조 ② 단서)**: v0.2는 미등기 가정 false, 다주택 중과 미구현이므로 모든 다주택 케이스를 표 1로 처리. v0.3에서 중과 대상 → 표 1 배제로 변경 예정 (issueFlag `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` 사전 노출).

### 5-2. 표 1 (일반) — 소득세법 제95조 ② 표 1

| 보유기간 (동월동일 비교) | 공제율 |
|---|---|
| 3년 이상 4년 미만 | 6% |
| 4년 이상 5년 미만 | 8% |
| 5년 이상 6년 미만 | 10% |
| 6년 이상 7년 미만 | 12% |
| 7년 이상 8년 미만 | 14% |
| 8년 이상 9년 미만 | 16% |
| 9년 이상 10년 미만 | 18% |
| 10년 이상 11년 미만 | 20% |
| 11년 이상 12년 미만 | 22% |
| 12년 이상 13년 미만 | 24% |
| 13년 이상 14년 미만 | 26% |
| 14년 이상 15년 미만 | 28% |
| 15년 이상 | 30% |

산식 (v0.2.1, 룩업 테이블 방식 — §0-1 원칙 (2)·(3) 적용):

```
holdingYears = 동월동일 비교 산출 정수 연차 (v0.1.1 §3)

// tax_rules.js v0.2가 노출하는 룩업 테이블·함수 사용
// 법령 표(시행령 제95조 ② 표 1) 그대로 보유, 산식 형태 금지
table1Rate = findHoldingRate(holdingYears, LONG_TERM_DEDUCTION_TABLE_1)

// 클램프(룩업 함수 내부 처리, 명세상 명시):
//   holdingYears < 3   → 0       (표 1 적용 없음)
//   3 ≤ holdingYears < 15 → 표 1 해당 행 (6%, 8%, 10%, 12%, 14%, 16%, 18%,
//                                       20%, 22%, 24%, 26%, 28%)
//   holdingYears ≥ 15  → 0.30    (표 최대 행으로 클램프)

longTermDeduction = Math.floor(taxableGain × table1Rate)
```

> **산식 표기 금지 (v0.2.1 정정)**: v0.2.0 명세서의 `0.06 + (holdingYears − 3) × 0.02` 표기는 본 표와 결과가 수학적으로 동치이나 **산식 형태로 코드에 두지 않는다**. 법령 개정 시 표 행이 등차수열을 깰 가능성이 있어 룩업 형태가 안전하다 (§0-1 원칙 (2)).

> **`findHoldingRate(holdingYears, table)` 함수 시그니처 안내**: 본 명세서는 함수 시그니처만 규정한다. 입력 `holdingYears: number`, `table: object[]`. 출력 `rate: number`. 클램프 정책(3년 미만 0%, 15년 이상 30%)은 룩업 함수 내부에서 처리한다. 함수 본문 구현은 `tax_rules.js` v0.2 코드 단계에서 결정한다 (작업지시서 03 — `docs/05_code_work_orders/03_tax_rules_v0.2.md`, 5/1 작성 예정).

### 5-3. 표 2 (1세대1주택) — 소득세법 제95조 ② 표 2

#### 5-3-1. 보유공제율 (표 2 좌측)

| 보유기간 | 보유공제율 |
|---|---|
| 3년 이상 4년 미만 | 12% |
| 4년 이상 5년 미만 | 16% |
| 5년 이상 6년 미만 | 20% |
| 6년 이상 7년 미만 | 24% |
| 7년 이상 8년 미만 | 28% |
| 8년 이상 9년 미만 | 32% |
| 9년 이상 10년 미만 | 36% |
| 10년 이상 | 40% |

#### 5-3-2. 거주공제율 (표 2 우측)

| 거주기간 | 거주공제율 | 비고 |
|---|---|---|
| 2년 이상 3년 미만 | 8% | **보유기간 3년 이상에 한정** |
| 3년 이상 4년 미만 | 12% | |
| 4년 이상 5년 미만 | 16% | |
| 5년 이상 6년 미만 | 20% | |
| 6년 이상 7년 미만 | 24% | |
| 7년 이상 8년 미만 | 28% | |
| 8년 이상 9년 미만 | 32% | |
| 9년 이상 10년 미만 | 36% | |
| 10년 이상 | 40% | |

> **표 2 좌측·우측 분리 정의 — 거주 2~3년 미만 8%는 거주공제율에만 존재**. 보유공제율은 3년부터 시작, 거주공제율은 2년부터 시작(보유 3년 이상 한정).

#### 5-3-3. 합산 산식 (v0.2.1, 룩업 테이블 방식 — §0-1 원칙 (2)·(3) 적용)

```
holdingYears   = 동월동일 비교 산출 정수 연차
residenceYears = Math.floor(residenceMonths / 12)

// tax_rules.js v0.2가 노출하는 룩업 테이블·함수 사용
// 법령 표(시행령 제95조 ② 표 2) 좌측·우측 그대로 보유, 산식 형태 금지

// 보유공제율 룩업 (표 2 좌측, 8행)
holdingRate = findHoldingRate(holdingYears, LONG_TERM_DEDUCTION_TABLE_2_HOLDING)
// 클램프(룩업 함수 내부 처리, 명세상 명시):
//   holdingYears < 3   → 0       (표 2 적용 없음 → 상위 분기에서 차단됨)
//   3 ≤ holdingYears < 10 → 표 2 좌측 해당 행 (12%, 16%, 20%, 24%, 28%, 32%, 36%)
//   holdingYears ≥ 10  → 0.40   (표 최대 행으로 클램프)

// 거주공제율 룩업 (표 2 우측, 9행 — "보유 3년 이상 + 거주 2~3년 미만 8%" 단서 포함)
residenceRate = findResidenceRate(residenceYears, holdingYears, LONG_TERM_DEDUCTION_TABLE_2_RESIDENCE)
// 클램프(룩업 함수 내부 처리, 명세상 명시):
//   holdingYears < 3   → 0       (보유 3년 이상 한정 단서)
//   residenceYears < 2 → 0       (거주 2년 미만 미적용)
//   2 ≤ residenceYears < 3 → 0.08 (단서 행, 보유 3년 이상에서만 활성)
//   3 ≤ residenceYears < 10 → 표 2 우측 해당 행 (12%, 16%, 20%, 24%, 28%, 32%, 36%)
//   residenceYears ≥ 10 → 0.40   (표 최대 행으로 클램프)

table2Rate = holdingRate + residenceRate                 // 최대 0.80
longTermDeduction = Math.floor(taxableGain × table2Rate)
```

> **산식 표기 금지 (v0.2.1 정정)**: v0.2.0 명세서의 `holdingYears × 0.04` / `residenceYears × 0.04` 표기는 본 표와 결과가 수학적으로 동치이나 **산식 형태로 코드에 두지 않는다**. 특히 표 2 거주공제율은 "보유 3년 이상에 한정" 단서가 등차수열로 표현되지 않으므로 룩업이 더 자연스럽다 (§0-1 원칙 (2)).

> **함수 시그니처 안내 (v0.2.1)**:
> - `findHoldingRate(holdingYears, table)` — 표 1·표 2 좌측 모두 동일 시그니처. 보유연수 정수만 받아 룩업.
> - `findResidenceRate(residenceYears, holdingYears, table)` — 표 2 우측 단서(보유 3년 이상)가 거주공제율 룩업의 입력에 포함되어야 함. 함수 본문은 룩업 시 보유연수 < 3이면 0 반환.
> - 함수 본문 구현은 `tax_rules.js` v0.2 코드 단계에서 결정한다 (작업지시서 03).

#### 5-3-4. 표 2 적용 자격 정리

- **표 2는 `is1Se1House === true && isHighValueHouse === true` 케이스에만 적용**된다 (12억 이하 비과세는 단계 2에서 종료되므로 표 2 호출 불필요).
- 보유 < 3년인 1세대1주택 12억 초과 케이스(보유 2~3년)는 표 2 미적용 → `longTermDeduction = 0` + `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2` (info) issueFlag.

### 5-4. 절사 정책

- `holdingRate`, `residenceRate`, `table1Rate`, `table2Rate`: 비율이므로 절사하지 않음.
- `longTermDeduction`: **`Math.floor`로 정수 변환**.

### 5-5. 보유연수·거주연수 산정 일관성

- 보유연수: 명세서 v0.1.1 §3 동월동일 비교 알고리즘 그대로.
- 거주연수: `Math.floor(residenceMonths / 12)` (개월 단위 입력값을 연차로 단순 변환).
- 동월동일 마크는 v0.1.1 §3과 동일하게 음수 연차 검증 + 경계 케이스 issueFlag(`HOLDING_PERIOD_BOUNDARY`) 처리. 마크 추가: 2년·3년·15년.

---

## 6. issueFlag 발동 조건

### 6-1. v0.2 신규 issueFlag (5종)

| code | 발동 조건 | severity | lawRef | message 예시 |
|---|---|---|---|---|
| `IS_1SE_1HOUSE` | `is1Se1House === true` | info | 소득세법 제89조 ①ⅲ, 시행령 제154조 | "1세대1주택 비과세가 적용되었습니다 (보유 N년, 거주 N년)." |
| `IS_HIGH_VALUE_HOUSE` | `is1Se1House && salePrice >= 1,200,000,000` | info | 제95조 ③, 시행령 제160조 | "양도가액 12억원 초과분에 안분 과세가 적용되었습니다 (안분비율 NN.NN%)." |
| `LONG_TERM_DEDUCTION_TABLE_1` | `appliedDeductionTable === 1` | info | 제95조 ② 표 1 | "장기보유특별공제 표 1 적용 (보유 N년 → NN%)." |
| `LONG_TERM_DEDUCTION_TABLE_2` | `appliedDeductionTable === 2` | info | 제95조 ② 표 2 | "장기보유특별공제 표 2 적용 (보유 NN% + 거주 NN% = 합계 NN%)." |
| `ONE_TIME_2HOUSES_NOT_APPLIED` | `isOneTimeTwoHouses === true` | warning | 시행령 제155조 ① | "일시적 2주택 특례는 v0.2에서 미적용. 다주택 일반과세로 처리됩니다. v0.3에서 정확한 산정 예정입니다." |

### 6-2. v0.1 기존 issueFlag 변경 (5종)

| code | v0.1 동작 | v0.2 동작 |
|---|---|---|
| `LONG_TERM_DEDUCTION_NOT_APPLIED` | 보유 ≥ 3년 시 항상 발동 | **폐기**. `LONG_TERM_DEDUCTION_TABLE_1`/`_TABLE_2`로 대체. 보유 < 3년 미적용은 issueFlag 없음(자연 미적용). |
| `POSSIBLE_NON_TAXATION_1H1H` | 보유 ≥ 2년 + 거주 ≥ 24M + candidateHouseCount === 1 | **발동조건 변경**: `is1Se1House === false && householdHouseCount === 1 && holdingYears >= 2 && residenceMonths >= 24` (비과세 적용 안 됐지만 잠재 가능 케이스). 비과세 적용된 경우는 `IS_1SE_1HOUSE` 발동으로 중복 회피. |
| `HIGH_VALUE_HOUSE` | salePrice ≥ 12억 시 항상 발동 | **발동조건 변경**: `is1Se1House === false && salePrice >= 12억`. 비과세 + 12억 초과는 `IS_HIGH_VALUE_HOUSE`로 대체. |
| `OUT_OF_V01_SCOPE_REGULATED_AREA` | 취득·양도 어느 한쪽이라도 조정대상지역 | **발동조건 축소**: `saleRegulated === true`만. 취득시 조정대상지역은 v0.2 거주요건 정상 활용이므로 미발동. (v0.3에서 `OUT_OF_V0X_SCOPE_REGULATED_AREA_AT_SALE`로 개명 검토.) |
| `UNREGISTERED_ASSET_ASSUMED_FALSE` | 항상 | **이름 통일 권고**: `UNREGISTERED_RATE_NOT_APPLIED`로 변경 권고. 작업 창 #6 본 패치 명시. 발동 조건 동일(항상). |

### 6-3. v0.1 issueFlag 그대로 유지 (5종)

| code | 발동 조건 | 비고 |
|---|---|---|
| `OUT_OF_V01_SCOPE_DATE` | `saleDate < APPLICABLE_SALE_DATE_FROM` | 이름은 v0.1 잔존 유지 |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | 항상 | 동일 |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | 항상 | 동일 |
| `HOLDING_PERIOD_BOUNDARY` | 1년/2년 마크 ±3일 | **확장**: 2년·3년·15년 마크의 ±3일 (비과세 보유요건·표 1 시작·표 2 보유·표 1 상한 경계) |
| `TRANSFER_LOSS_DETECTED` | `transferGain < 0` | 동일 |

### 6-4. v0.2 보조 issueFlag (3종)

| code | 발동 조건 | severity | 목적 |
|---|---|---|---|
| `RESIDENCE_MONTHS_USER_INPUT` | 항상 | info | 거주기간 산정은 사용자 책임 명시 |
| `RESIDENCE_EXEMPTION_NOT_HANDLED` | `acquisitionRegulated && residenceMonths < 24` | info | 거주요건 면제 사유(공익사업 수용 등) v0.2 미처리 |
| `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2` | `is1Se1House && isHighValueHouse && holdingYears < 3` | info | 1세대1주택 12억 초과지만 보유 3년 미만이라 표 2 미적용 |

### 6-5. v0.3 사전 노출 issueFlag (v0.2 비활성)

| code | 활성 시점 | 비고 |
|---|---|---|
| `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` | v0.3 다주택 중과 진입 시 | 중과 대상 시 표 1 적용 배제 |

### 6-6. issueFlag 합계

v0.2: **신규 5 + 보조 3 + 변경 5 + 유지 5 + 폐기 1 = 활성 18종**. (v0.1 10종 → v0.2 18종)

---

## 7. 입력 검증 규칙 (validateCaseData v0.2)

### 7-1. v0.1 검증 항목 (그대로 유지)

명세서 v0.1.1 §8 8개 항목 그대로. 단 `acquisitionRegulated`는 v0.1에서 issueFlag 발동 항목이었으나 v0.2에서는 거주요건 판정 입력으로 활성(에러·경고 발동 안 함).

### 7-2. v0.2 신규 검증 항목

| 항목 | 규칙 | 실패 시 |
|---|---|---|
| `householdHouseCount` | 정수 ≥ 1 | 누락 시 §7-3 자동 보정. 정수 음수·0 입력 시 에러 |
| `residenceMonths` | 정수 ≥ 0 | 누락 시 0 자동 보정 + `RESIDENCE_MONTHS_DEFAULTED_ZERO`(info) |
| `livingNow` | boolean | 누락 시 false 자동 보정 |
| `isOneTimeTwoHouses` | boolean | 누락 시 false 자동 보정 |
| `acquisitionRegulated` | boolean | 누락 시 false 자동 보정 (v0.1 호환) |

### 7-3. 자동 보정 룰 (의사결정 #10 v0.1.2 패치 + v0.2 신규)

| 필드 | 누락 시 자동 보정값 | issueFlag |
|---|---|---|
| `specialTaxFlags` (v0.1.2) | `{ isFarmHouse: false, isHometownHouse: false, isPopulationDeclineAreaHouse: false, isLongTermRental: false }` | 없음 |
| `specialTaxRequirementsMet` (v0.1.2) | `[]` | 없음 |
| `householdHouseCount` (v0.2) | `salePlan.candidateHouseIds.length`로 추정 (v0.1 회귀 안전성) | `HOUSEHOLD_COUNT_INFERRED` (info) |
| `isOneTimeTwoHouses` (v0.2) | `false` | 없음 |
| `livingNow` (v0.2 활성) | `false` | 없음 |
| `acquisitionRegulated` (v0.2 활성) | `false` | 없음 |
| `residenceMonths` (v0.2 활성) | `0` | `RESIDENCE_MONTHS_DEFAULTED_ZERO` (info) |

> **v0.1 회귀 안전성 — 골든셋 입력 패치 필수**: TC-001~005는 `householdHouseCount` 미입력 상태로 작성됨. 자동 보정만으로는 v0.1 결과를 보장할 수 없음(§9-1). 따라서 `docs/v0.1/06_test_cases.md`를 v0.1.2로 패치하여 TC-001~005 입력에 `householdHouseCount: 2`를 추가하는 별도 패치를 본 명세서 부수 산출물로 권고.

### 7-4. validateCaseData 호출 시점

`calculateSingleTransfer` 진입부에서 0단계로 1회 호출. 자동 보정은 호출 직후 1회 적용. 호출 측이 사전 호출 가능(v0.1.1과 동일).

---

## 8. 함수 계약 (모듈 스펙 인터페이스)

### 8-1. v0.2 신규 노출 함수 (3개)

| 함수 | 입력 | 출력 | 비고 |
|---|---|---|---|
| `check1Se1HouseExemption(input)` | `{ householdHouseCount, acquisitionDate, saleDate, acquisitionRegulated, residenceMonths, salePrice }` | `{ is1Se1House: boolean, isHighValueHouse: boolean, terminateAt2: boolean, holdingYears: number, residenceYears: number, reason: string }` | 단계 2 본문 |
| `calculateHighValuePortion(input)` | `{ transferGain, salePrice }` | `{ taxableGain: number, allocationRatio: number }` | 단계 3 본문 |
| `calculateLongTermDeduction(input)` | `{ taxableGain, holdingYears, residenceYears, is1Se1House, isHighValueHouse }` | `{ longTermDeduction: number, appliedDeductionTable: 1\|2\|null, holdingRate: number, residenceRate?: number, totalRate: number }` | 단계 4 본문 |

### 8-2. v0.1 기존 함수 (시그니처 유지, 본문 활성)

| 함수 | v0.2 변경 |
|---|---|
| `applyNonTaxation(transferGain, caseData)` | 본문 활성: 내부에서 `check1Se1HouseExemption` 호출 후 결과 반영 |
| `applyHighValueAllocation(taxableGain, caseData)` | 본문 활성: 내부에서 `calculateHighValuePortion` 호출 |
| `computeLongTermDeduction(taxableGain, caseData)` | 본문 활성: 내부에서 `calculateLongTermDeduction` 호출 |

### 8-3. 결과 객체 출력 스키마 보강

`calculateSingleTransfer`의 결과 객체 `result.steps`에 다음 필드 추가:

| 필드 | 타입 | 의미 |
|---|---|---|
| `is1Se1House` | boolean | 비과세 적용 여부 |
| `isHighValueHouse` | boolean | 12억 초과 안분 진입 여부 |
| `allocationRatio` | number | 안분비율 (1.0 또는 (salePrice−12억)/salePrice) |
| `appliedDeductionTable` | `1` \| `2` \| `null` | 적용 표 |
| `holdingYears` | number | 보유 정수 연차 |
| `residenceYears` | number | 거주 정수 연차 |
| `holdingRate` | number | 보유공제율 (표 1·2 공통) |
| `residenceRate` | number | 거주공제율 (표 2 한정, 표 1은 0) |
| `totalRate` | number | 적용 공제율 합계 |
| `terminateAt2` | boolean | 단계 2 종료 여부 |

자세한 출력 스키마는 `docs/v0.2/modules/tax_engine.md` 참조.

---

## 9. 회귀 검증 원칙 (v0.1 골든셋)

v0.2 코드는 다음 5개 v0.1 골든셋을 **그대로 통과해야** 한다.

| TC | salePrice | 보유 | v0.2 결과 |
|---|---|---|---|
| TC-001 | 8억 | 6년 7개월 | totalTax 98,241,000 (v0.1 동일) |
| TC-002 | 7억 | 1년 7개월 | totalTax 61,050,000 (v0.1 동일) |
| TC-003 | 4.8억 | 6년 4개월 | totalTax 0 (v0.1 동일) |
| TC-004 | 8억 | 6년 7개월 | totalTax 99,286,000 (v0.1 동일) |
| TC-005 | 2.165억 | 8년 4개월 | totalTax 924,000 (v0.1 동일) |

### 9-1. v0.1 골든셋의 1세대1주택 판정 충돌 — 입력 패치 권고

TC-001·003·004·005는 보유 ≥ 2년이고 자동 보정 시 `householdHouseCount = candidateHouseIds.length = 1`이 된다. 그러면:

- `acquisitionRegulated === false` (v0.1 가정 기본): 거주요건 면제 → **비과세 적용 가능**
- `salePrice < 12억`: 단계 2 종료 → **totalTax = 0**

→ v0.1 정답값(예: TC-001 totalTax = 98,241,000)과 **충돌**.

**해결 (필수)**: `docs/v0.1/06_test_cases.md`를 **v0.1.2**로 패치하여 TC-001~005 입력에 **`householdHouseCount: 2`**를 추가.

근거:
1. v0.1은 다주택 중과 미구현이므로 `householdHouseCount = 2` 자체로는 일반과세 분기 진입(중과 미적용).
2. 1세대1주택 비과세 자연 회피.
3. v0.3 다주택 중과 적용 시에도 비조정대상지역(`saleRegulated = false`)이라 중과 미발동, 일반과세 결과 동일 유지.

본 패치는 **v0.2 작업의 부수 산출물**로 별도 작업지시서 또는 Claude Code 직접 패치로 처리. 검증팀은 패치 적용 전·후 모두 회귀 결과가 동일함을 확인.

### 9-2. v0.2 신규 골든셋 (TC-006~010)

`docs/v0.2/06_test_cases.md` 참조.

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.0 | 2026-04-26 | 초기 명세서 |
| v0.1.1 | 2026-04-28 | P1~P10 패치, 검증팀 + 홈택스 3자 일치 확정 |
| v0.2.0 | 2026-04-30 | **3·4·5단계 활성화**: 1세대1주택 비과세, 고가주택 안분, 장특공 표 1·표 2. issueFlag 신규 5종 + 변경 5종(폐기 1 포함) + 보조 3종. 입력 스키마 v0.1.2 활용. v0.1 골든셋 입력 `householdHouseCount: 2` 추가 패치 권고(§9-1). |
| v0.2.1 | 2026-05-01 | (1) **TC-006~010 검증팀 손계산 + 홈택스 모의계산 3자 일치 확정 (KPI 100%)**. 5건 totalTax 결과 그대로 보존. (2) **장특공 산식 표기 룩업 테이블로 통일** (검증팀 4/30 피드백 반영, 결과 변경 없음). §5-2 표 1·§5-3-3 표 2의 등차수열 산식 표기 → 룩업 테이블 + `findHoldingRate`/`findResidenceRate` 함수 시그니처 안내로 정정. (3) **법령 개정 대응 아키텍처 원칙 명시** (§0-1 신설, 의사결정 #5 강화 — 백로그 B-020 추적). (4) §11 5건 미확정 항목은 그대로 유지(작업지시서 03 작성 시 결정). |

---

## 11. 검증 후 보류 항목

다음 5건은 v0.2 검증팀 손계산 후 결정:

1. **거주공제율 2~3년 미만 8% 분기의 단순 산식 적정성** (§5-3-3) — 검증팀 손계산 시 산식 동치성 확인.
2. **고가주택 안분 절사 위치** (§4-3) — 단계 3 1회 절사 vs 단계 4 분리 절사. 홈택스 모의계산과 비교.
3. **TC-001~005 회귀 안전성** (§9-1) — `householdHouseCount: 2` 패치 적용 시 5건 모두 v0.1 정답값 그대로인지 코드 회귀로 확인.
4. **`POSSIBLE_NON_TAXATION_1H1H` 발동조건 변경의 의미적 적정성** (§6-2) — v0.1에서 발동된 케이스가 v0.2에서 발동 안 하면 v0.4 결과 화면 표시 어법 영향 검토.
5. **단계 4 표 2 적용 시 보유공제율의 정확한 산출** — `holdingYears = 10` 경계의 40% 클램프, `holdingYears < 3` 분기에서 표 2 진입 자체 차단의 일관성.
