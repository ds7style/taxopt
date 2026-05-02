# TaxOpt 계산 엔진 명세서 v0.3-A

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.3/01_calc_engine_spec.md` |
| 버전 | v0.3-A (다주택 중과 + saleRegulated 활성, 시나리오 엔진 미포함) |
| 상태 | ⏳ **검증 대기** (검증팀 손계산 + 홈택스 모의계산 3자 일치 검증 예정) |
| 작성일 | 2026-05-02 (작업 창 #10 산출) |
| 적용 법령 | 소득세법 [법률 제21065호, 시행 2026-01-02] / 시행령 [대통령령 제36129호, 시행 2026-03-01] |
| 적용 전제 | 양도일 ≥ 2026-05-10 (중과 유예 종료 후), saleRegulated 입력 활성, 거주자, 단독명의, 매매취득, 등기자산 |
| 다음 버전 | v0.3-B (시나리오 엔진), post-MVP (자동 조정대상지역 판정·일시적 2주택·보유세·NPV) |
| 의사결정 준수 | #1 (중과 유예 처리), #2 (v0.3 범위), #5 강화 (법령 개정 대응 아키텍처 — §0-1), #9 v9 (.js 코드 산출 금지), #10 (시나리오 엔진은 v0.3-B), #11 (정확성 > 속도) |
| 백로그 추적 | B-024 (일시적 2주택 — v0.3-A 미포함 결정), B-032 (결과 객체 구조 불일치 — v0.3-A 범위 외), B-033 (자동 조정대상지역 판정 — post-MVP) |

---

## 0. v0.2.1 → v0.3-A 변경 요약

v0.3-A는 v0.2.1의 13단계 파이프라인 골격을 그대로 유지하면서 **단계 4·8·9의 다주택 중과 분기를 활성화**한다. 단계 0·1·2·3·5·6·7·10·11·12·13 본문은 변경 없음. 따라서 **v0.1 골든셋 TC-001~005 + v0.2 골든셋 TC-006~010 10건은 그대로 회귀 통과해야** 한다 (§9 회귀 원칙).

| 단계 | v0.2.1 동작 | v0.3-A 동작 |
|---|---|---|
| 0 | validateCaseData (13개 필드, 자동 보정 7종) | 동일 (saleRegulated 기존 검증 유지, 신규 검증 없음) |
| 1 | `transferGain = salePrice − acquisitionPrice − necessaryExpense` | 동일 |
| 2 | 1세대1주택 비과세 판정 | 동일 |
| 3 | 12억 초과 고가주택 안분 | 동일 |
| 4 | 표 1·표 2 분기 적용 | **변경**: 다주택 중과 판정 시 `longTermDeduction = 0` (제95조 ② 단서, §3-3) |
| 5~7 | 양도소득금액·기본공제·과세표준 산출 | 동일 |
| 8 | 보유기간 분기 (`under1y`·`under2y`·`over2y`) | 동일 (분기 자체 불변, 단 `under2y` + 중과 케이스는 제104조 ⑦ 단서 적용 — §3-5) |
| 9 | 단기세율 또는 누진세율 적용 | **변경**: 중과 시 누진세율 + 가산세율(`+20%p` / `+30%p`) (§3-2, §3-4) |
| 10~13 | 산출세액·지방소득세·총세액·세후 매각금액 | 동일 |

> **인터페이스 약속**: 13단계 함수 시그니처는 v0.2.1과 동일하게 유지. 함수 본문만 활성화. v0.3-A는 단계 4·9에 중과 분기 추가, 단계 8은 분기 산출 자체는 v0.2.1과 동일.

### 0-1. 법령 개정 대응 아키텍처 (의사결정 #5 강화 — v0.2.1 §0-1 그대로 인용)

본 명세서가 정의하는 모든 **법령 명시 숫자**(임계 금액·세율·공제액·공제율 표·연차 분기 임계·**다주택 중과 가산세율**)는 다음 3가지 원칙을 따른다. v0.3-A 신규 가산세율(+20%p, +30%p)도 본 원칙을 그대로 적용한다.

| 원칙 | 내용 | v0.3-A 적용 |
|---|---|---|
| (1) **단일 소스** | 법령 명시 숫자는 모두 `tax_rules.js` 단일 모듈에 둔다. 어느 다른 모듈도 법령 숫자를 직접 보유하지 않는다. | 다주택 중과 가산세율(+20%p / +30%p)은 `tax_rules.js`에 룩업 테이블 `HEAVY_TAX_RATE_ADDITION`으로 단일 보유. `tax_engine.js`·`scenario_engine.js`·`input_collector.js`는 보유 금지. |
| (2) **룩업 테이블 우선** | 법령 표는 표 그대로 룩업 테이블 형태로 정의한다. 등차수열 산식이 표와 결과가 동치이더라도 산식 형태는 금지. | `HEAVY_TAX_RATE_ADDITION = [{ houseCount: 2, addition: 0.20 }, { houseCount: 3, addition: 0.30 }]` 형태의 룩업. 2주택·3주택 분기를 표 형태로 보유. |
| (3) **산식 흐름 분리** | `tax_engine.js`는 13단계 산식 흐름만 담당한다. 숫자·표는 룩업 함수 호출로 받는다. | 단계 9 중과 적용 시 `tax_engine.js`는 `tax_rules.findHeavyTaxRateAddition(houseCount)`를 호출하여 가산세율을 받는다. 누진 구간 누적 세액 재계산은 산식 흐름이므로 `tax_engine.js` 책임. |

#### 0-1-1. v0.3-A에서 영향받는 영역

| 영역 | v0.2.1 표기 | v0.3-A 표기 |
|---|---|---|
| §3-2 다주택 중과 가산세율 산식 | (해당 없음) | **`HEAVY_TAX_RATE_ADDITION` 룩업 테이블** + `findHeavyTaxRateAddition(houseCount)` 함수 호출. 등차수열 산식(`(houseCount−1) × 0.10`) 금지. |
| §3-4 단계 9 중과 시 산출세액 산식 | (해당 없음) | 누진 구간 누적 세액에 가산세율을 가산한 재계산 흐름 (`tax_engine.js` 책임). 가산세율 자체는 룩업 함수에서 획득. |

#### 0-1-2. 가산세율 룩업 vs 중과 누진세율표 직접 보유의 비교

| 옵션 | 장점 | 단점 | 본 명세서 채택 |
|---|---|---|---|
| (가) `HEAVY_TAX_RATE_ADDITION` 룩업 + 동적 재계산 | 단일 소스 (가산세율 1개 룩업), 향후 가산세율 변경 시 룩업만 갱신 | 단계 9에 재계산 흐름 추가 (`tax_engine.js` 흐름 증가) | **✅ 채택** |
| (나) `PROGRESSIVE_BRACKETS_HEAVY_2HOUSE`·`_3HOUSE` 별도 테이블 | 단계 9에 재계산 흐름 없음 (`findBracket`만 호출) | 룩업 테이블 3개로 증가, 누진세율표 변경 시 3개 모두 갱신 필요 | 비채택 |

**채택 근거**: 법령 본문(제104조 ⑦)이 "세율에 100분의 20(또는 30)을 더한 세율을 적용한다"로 명시. 별도의 중과 누진세율표를 표로 제시하지 않음. 시행령에도 별도 표 없음. 따라서 룩업 테이블 우선 원칙(2)에 충실하려면 가산세율만 룩업으로 보유하고 누진 구간 적용은 `tax_engine.js`의 산식 흐름으로 처리.

---

## 1. 적용 범위

### 1-1. v0.3-A 포함 (신규 활성)

- **다주택 중과 판정** (소득세법 제104조 ⑦)
  - 4단계 조건: `householdHouseCount >= 2` AND `saleRegulated === true` AND 양도일 ≥ 2026-05-10 AND `is1Se1House === false`
  - 2주택 중과: 기본세율 + 20%p
  - 3주택 이상 중과: 기본세율 + 30%p
  - 중과 대상은 장기보유특별공제 적용 배제 (제95조 ② 단서)
- **`saleRegulated` 입력 활성** (양도시 조정대상지역 판정용)
  - v0.2까지 입력값 보존만, v0.3-A에서 본격 사용
- **단기세율과 중과세율 비교 (보유 < 2년 + 중과)**
  - 제104조 ⑦ 본문 단서: max(중과세율 산출세액, 단기세율 산출세액) 적용

### 1-2. v0.3-A 제외 (issueFlag로만 표시)

- **시나리오 엔진** (어느 1채·순서·시점 비교) — **v0.3-B** (별도 작업 창)
- **자동 조정대상지역 판정** — post-MVP (B-033, B-021 통합)
- **일시적 2주택 특례** (시행령 제155조 ①) — issueFlag `ONE_TIME_2HOUSES_NOT_APPLIED` warning 그대로 유지. v0.3-A에 포함하지 않음 (인계 4 결정).
- **장기임대주택 등 중과 배제 사유** (제104조 ⑦ 단서, 시행령 제167조의10·11) — issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` (info) 신규 발동
- **강남3구·용산 한시 유예 (계약 2026-05-09 이전 + 잔금 4개월 이내)** — issueFlag `HEAVY_TAX_TRANSITION_NOT_HANDLED` (info)
- **종전 미반영 항목 보존**: 미등기양도자산 70%·상속·증여·부담부증여·부부공동명의·조합원입주권·분양권·재건축 통산·거주요건 면제 등 (v0.2와 동일)

### 1-3. 적용 전제 (v0.2.1 → v0.3-A 변경)

| 전제 | v0.2.1 내용 | v0.3-A 변경 |
|---|---|---|
| 양도일 | ≥ 2026-05-10 | 동일 (의사결정 #1) |
| 양도 시 소재지 | 비조정대상지역 | **변경**: `saleRegulated` 입력 활성. true·false 모두 허용. |
| 취득 시 소재지 | 조정대상지역 입력 활성 (거주요건 판정용) | 동일 |
| 거주성·명의·취득원인·등기 | 거주자·단독명의·매매취득·등기자산 | 동일 |
| 1세대 보유주택 수 | 입력 활성 (비과세 판정용) | **변경**: 비과세 판정 + 다주택 중과 판정 양쪽 모두 사용 |

### 1-4. 인계 4 처리 — B-024 (일시적 2주택) v0.3-A 포함 여부

**결정 (본 명세서)**: **옵션 (나) 미포함**. 일시적 2주택 특례는 v0.3-B 또는 post-MVP 인계.

**근거**:
1. 시행령 제155조 ①의 일시적 2주택 비과세는 (a) 종전주택 보유 1년 + 신규주택 취득 (b) 신규주택 취득 후 3년 이내 종전주택 양도 등 입력 스키마 확장이 필요한 복잡한 분기. v0.3-A 입력 스키마는 단일 주택 양도(`salePlan.candidateHouseIds.length === 1`)만 다루므로 종전·신규 식별 불가.
2. 의사결정 #11 (정확성 > 속도): 본 작업 창은 다주택 중과 + saleRegulated 활성에 집중. 일시적 2주택은 별건으로 분리.
3. 백로그 B-024가 "v0.3 또는 v0.5"로 처리 시점 미정으로 등록되어 있으며, 본 명세서 작성 시 v0.3-A 포함은 산식·입력 스키마 양쪽 모두 추가 작업 필요.
4. v0.3-A의 본질 가치는 "중과 적용 vs 미적용 비교 가능성"이며, 일시적 2주택은 그 본질과 직교.

**처리**: 백로그 B-024는 그대로 유지 (open). v0.3-B 시나리오 엔진 진입 후 또는 post-MVP에서 본격 처리.

---

## 2. 계산 파이프라인 (13단계, v0.3-A 활성판)

| 단계 | 변수 | 계산식 | v0.3-A 변경 | 근거 |
|---|---|---|---|---|
| 0 | — | `validateCaseData(caseData)` + 자동 보정 | 동일 | — |
| 1 | `transferGain` | `salePrice − acquisitionPrice − necessaryExpense` | 동일 | 제95조 ①, 제96조, 제97조 |
| 2 | `is1Se1House`, `taxableGain` | 1세대1주택 비과세 판정 (v0.2.1 §3) | 동일 | 제89조 ①ⅲ, 시행령 제154조 |
| 3 | `taxableGain` | 12억 초과 안분 (v0.2.1 §4) | 동일 | 제95조 ③, 시행령 제160조 ① |
| 4 | `longTermDeduction` | 표 1·표 2 분기 (v0.2.1 §5). **단, 다주택 중과 시 0** | **변경 (§3-3)** | 제95조 ② 표 1·표 2 + 단서 |
| 5 | `capitalGainIncome` | `taxableGain − longTermDeduction` | 동일 | 제95조 ① |
| 6 | `basicDeduction` | `basicDeductionUsed ? 0 : 2,500,000` | 동일 | 제103조 |
| 7 | `taxBase` | `max(0, capitalGainIncome − basicDeduction)` | 동일 | 제92조 ② |
| 8 | `holdingPeriodBranch` | 보유기간 분기 (`under1y`·`under2y`·`over2y`) | 동일 | 제104조 ① |
| 9 | `appliedRate`, `calculatedTax` | 단기세율 또는 누진세율 적용. **다주택 중과 시 가산세율 추가** | **변경 (§3-4, §3-5)** | 제55조 ①, 제104조 ⑦ |
| 10 | `calculatedTax` | `Math.floor(...)` 절사 | 동일 | — |
| 11 | `localIncomeTax` | `Math.floor(calculatedTax × 0.1)` | 동일 | 지방세법 제103조의3 |
| 12 | `totalTax` | `calculatedTax + localIncomeTax` | 동일 | — |
| 13 | `netAfterTaxSaleAmount` | `salePrice − totalTax` | 동일 | — |

> 단계 0·1·2·3·5·6·7·10·11·12·13 본문은 v0.2.1 명세서 §2~§4 그대로 사용. 본 명세서는 단계 4·9 변경분과 다주택 중과 판정 메커니즘(§3)만 상세 기술.

---

## 3. 다주택 중과 판정 (v0.3-A 신규)

### 3-1. 판정 4단계 조건

다주택 중과 적용 여부는 다음 4단계 조건을 **모두 충족**할 때 발동한다. AND 결합.

| # | 조건 | 입력값 | 평가 시점 |
|---|---|---|---|
| 1 | 다주택 보유 | `caseData.householdHouseCount >= 2` | 단계 4 진입 직전 |
| 2 | 양도시 조정대상지역 | `house.saleRegulated === true` | 단계 4 진입 직전 |
| 3 | 양도일 중과 유예 종료 후 | `saleDate >= APPLICABLE_SALE_DATE_FROM` (`"2026-05-10"`) | 단계 0 검증 시 + 단계 4 진입 직전 재확인 |
| 4 | 1세대1주택 비과세 미적용 | `is1Se1House === false` (단계 2 결과) | 단계 4 진입 직전 |

**평가 함수**: `isHeavyTaxationApplicable(caseData, intermediates)` (단계 4 진입 직전에 내부 호출)

```
function isHeavyTaxationApplicable(caseData, intermediates) {
  // 조건 1: 다주택
  if (caseData.householdHouseCount < 2) return false;
  // 조건 2: 양도시 조정대상지역
  var house = pickHouseFromCaseData(caseData);
  if (house.saleRegulated !== true) return false;
  // 조건 3: 양도일 중과 유예 종료 후
  if (house.expectedSaleDate < tax_rules.APPLICABLE_SALE_DATE_FROM) return false;
  // 조건 4: 1세대1주택 비과세 미적용
  if (intermediates.is1Se1House === true) return false;
  return true;
}
```

> **조건 3 재확인 이유**: 단계 0 `validateCaseData`에서 `saleDate < APPLICABLE_SALE_DATE_FROM`은 `OUT_OF_V01_SCOPE_DATE` warning만 발동하고 산출은 진행. 단계 4에서 다주택 중과 적용 여부를 판정할 때 양도일을 다시 확인하여, 유예 기간 내 양도는 중과 미적용으로 처리.

> **조건 4 보강**: 1세대1주택이면서 12억 초과(고가주택 안분)인 경우는 `is1Se1House === true`. 이 경우 비과세 분기를 적용하므로 중과 판정에서 제외. 단계 2의 `is1Se1House` 결과를 그대로 사용.

### 3-2. 가산세율 룩업 (`HEAVY_TAX_RATE_ADDITION`)

가산세율은 `tax_rules.js`의 `HEAVY_TAX_RATE_ADDITION` 룩업 테이블에 단일 보유한다. `tax_engine.js`는 `findHeavyTaxRateAddition(houseCount)` 함수 호출로만 가산세율을 획득한다.

#### 3-2-1. 룩업 테이블 정의

```js
// tax_rules.js v0.3-A
var HEAVY_TAX_RATE_ADDITION = [
  { houseCount: 2,           addition: 0.20, label: "1세대 2주택 중과 +20%p" },
  { houseCount: 3,           addition: 0.30, label: "1세대 3주택 이상 중과 +30%p" }
];
```

> 본 룩업 테이블은 시행령에 별도 표가 없으므로 **법령 본문(제104조 ⑦) 단서를 그대로 표로 옮긴 형태**다. 등차수열 산식(`(houseCount − 1) × 0.10`)은 의사결정 #5 강화 원칙 (2)에 따라 금지.

#### 3-2-2. 룩업 함수 시그니처

```js
function findHeavyTaxRateAddition(houseCount) {
  // 입력 검증
  if (typeof houseCount !== 'number' || !Number.isInteger(houseCount) || houseCount < 2) {
    throw new Error('findHeavyTaxRateAddition: houseCount must be integer >= 2');
  }
  // 클램프: 3주택 이상은 모두 +30%p
  var key = houseCount >= 3 ? 3 : 2;
  for (var i = 0; i < HEAVY_TAX_RATE_ADDITION.length; i++) {
    if (HEAVY_TAX_RATE_ADDITION[i].houseCount === key) {
      return HEAVY_TAX_RATE_ADDITION[i].addition;
    }
  }
  throw new Error('findHeavyTaxRateAddition: unreachable');
}
```

| 입력 | 출력 (addition) | 클램프 |
|---|---|---|
| `houseCount = 2` | `0.20` | — |
| `houseCount = 3` | `0.30` | — |
| `houseCount = 4` | `0.30` | 3주택 이상 클램프 |
| `houseCount = 10` | `0.30` | 3주택 이상 클램프 |
| `houseCount = 1` | (throw) | 호출 측이 단계 4 진입 전 isHeavyTaxationApplicable로 차단 |
| `houseCount = 0` | (throw) | 입력 검증 실패 |

### 3-3. 중과 시 장기보유특별공제 배제 (단계 4 변경)

**소득세법 제95조 ② 단서**: "다만, 제104조제7항에 따른 주택을 양도하는 경우에는 그러하지 아니하다." → **중과 적용 주택은 장기보유특별공제 적용 배제**.

#### 3-3-1. 단계 4 변경된 분기

| 분기 조건 | 적용 표 | longTermDeduction |
|---|---|---|
| 단계 2 종료 (`terminateAt2 === true`) | (호출 안 됨) | 0 |
| `holdingYears < 3` | 미적용 | 0 |
| **`isHeavyTaxationApplicable(caseData, intermediates) === true`** | **미적용 (중과 배제)** | **0** |
| `is1Se1House && isHighValueHouse && holdingYears >= 3` | 표 2 | `Math.floor(taxableGain × totalRate)` |
| 그 외 (`!is1Se1House && holdingYears >= 3`, 다주택 일반과세) | 표 1 | `Math.floor(taxableGain × holdingRate)` |

> 새 분기는 **표 2 분기보다 먼저** 평가되어야 하나, 중과 발동 조건 4(`is1Se1House === false`)와 표 2 자격(`is1Se1House === true`)이 상호배타적이므로 평가 순서가 결과에 영향을 주지 않음. 본 명세서는 가독성을 위해 다음 순서로 명시: (1) `terminateAt2`, (2) `holdingYears < 3`, (3) `isHeavyTaxation`, (4) 표 2 자격, (5) 표 1.

#### 3-3-2. `result.steps.appliedDeductionTable` 신규 값

v0.2.1에서 `appliedDeductionTable`은 `1` | `2` | `null`이었다. v0.3-A에서 `null` 사례에 **중과 배제**가 추가된다.

| 값 | 의미 | 발동 조건 |
|---|---|---|
| `1` | 표 1 적용 | 다주택 일반과세 + 보유 ≥ 3년 + 중과 미발동 |
| `2` | 표 2 적용 | 1세대1주택 + 12억 초과 + 보유 ≥ 3년 |
| `null` (보유<3년) | 미적용 (보유 부족) | 보유 < 3년 |
| **`null` (중과 배제)** | **미적용 (중과 배제)** | **중과 발동** |
| `null` (단계 2 종료) | 호출 안 됨 | `terminateAt2 === true` |

> `appliedDeductionTable === null` 자체는 v0.2.1과 동일. 본 명세서는 `null` 발생 사유를 issueFlag로 구분하여 표시 (§3-4, `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` 신규).

### 3-4. 중과 시 세율 적용 (단계 9 변경)

**소득세법 제104조 ⑦ 본문**: "다음 각 호의 어느 하나에 해당하는 주택을 양도하는 경우 제55조제1항에 따른 세율에 100분의 20(제3호 및 제4호의 경우 100분의 30)을 더한 세율을 적용한다."

#### 3-4-1. 중과 누진세율 산출 (보유 ≥ 2년)

기본 누진세율표(`PROGRESSIVE_BRACKETS`)의 각 구간 marginalRate에 가산세율(`addition`)을 더한 세율로 산출세액을 재계산한다. 누적 baseTax는 동적으로 재산출.

```
중과 누진세율 산출 산식:
  bracket = findBracket(taxBase)                    // {lowerBound, upperBound, marginalRate, baseTax}
  addition = findHeavyTaxRateAddition(houseCount)  // 0.20 or 0.30
  
  // 누적 baseTax 재계산 (lowerBound까지)
  baseTax_with_addition = 0
  for each prior bracket [L_i, U_i, R_i, _] with U_i <= bracket.lowerBound:
    baseTax_with_addition += (U_i − L_i) × (R_i + addition)
  
  // 산출세액 재계산
  calculatedTax_heavy = baseTax_with_addition 
                      + (taxBase − bracket.lowerBound) × (bracket.marginalRate + addition)
  
  calculatedTax = Math.floor(calculatedTax_heavy)
```

#### 3-4-2. 누진세율표 + 가산세율 합산표 (참고)

기본 누진세율표 (`PROGRESSIVE_BRACKETS`, v0.1 동일)에 가산세율을 더한 marginalRate를 표로 명시. **본 표는 명세서 검증용 참고 자료이며 코드에는 보유하지 않음** (단일 소스 원칙).

| 구간 (lowerBound 기준) | 기본 marginalRate | +20%p 후 | +30%p 후 |
|---|---|---|---|
| 0 ~ 1,400만 | 6% | 26% | 36% |
| 1,400만 초과 ~ 5,000만 | 15% | 35% | 45% |
| 5,000만 초과 ~ 8,800만 | 24% | 44% | 54% |
| 8,800만 초과 ~ 1억5천만 | 35% | 55% | 65% |
| 1억5천만 초과 ~ 3억 | 38% | 58% | 68% |
| 3억 초과 ~ 5억 | 40% | 60% | 70% |
| 5억 초과 ~ 10억 | 42% | 62% | 72% |
| 10억 초과 | 45% | 65% | 75% |

**최고세율 (10억 초과)**: 45% + 30%p = **75%**. 지방소득세 10% 추가 시 **82.5%** (PRD 03절 일치).

#### 3-4-3. 중과 시 baseTax_with_addition 누적 표 (참고)

각 구간의 lowerBound까지 누적 세액. 검증팀 손계산 보조용. **본 표는 명세서 검증용 참고 자료이며 코드에는 보유하지 않음**.

| lowerBound | 기본 baseTax (v0.1 동일) | +20%p 누적 baseTax | +30%p 누적 baseTax |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 14,000,000 | 840,000 | 3,640,000 | 5,040,000 |
| 50,000,000 | 6,240,000 | 16,240,000 | 21,240,000 |
| 88,000,000 | 15,360,000 | 32,960,000 | 41,760,000 |
| 150,000,000 | 37,060,000 | 67,060,000 | 82,060,000 |
| 300,000,000 | 94,060,000 | 154,060,000 | 184,060,000 |
| 500,000,000 | 174,060,000 | 274,060,000 | 324,060,000 |
| 1,000,000,000 | 384,060,000 | 584,060,000 | 684,060,000 |

**산출 검증 예시 (taxBase = 477,500,000, 2주택 중과)**:
- 구간: 3억 초과 ~ 5억 이하 (lowerBound = 300,000,000, marginalRate = 0.40)
- baseTax_with_addition (lowerBound 300,000,000까지) = 154,060,000
- calculatedTax_heavy = 154,060,000 + (477,500,000 − 300,000,000) × (0.40 + 0.20) = 154,060,000 + 177,500,000 × 0.60 = 154,060,000 + 106,500,000 = **260,560,000**

### 3-5. 보유 < 2년 + 중과 처리 (제104조 ⑦ 본문 단서)

**법령 본문**: "이 경우 해당 주택 보유기간이 2년 미만인 경우에는 제55조제1항에 따른 세율에 100분의 20(제3호 및 제4호의 경우 100분의 30)을 더한 세율을 적용하여 계산한 양도소득 산출세액과 제1항제2호 또는 제3호의 세율을 적용하여 계산한 양도소득 산출세액 중 큰 세액을 양도소득 산출세액으로 한다."

#### 3-5-1. 단계 9 분기 (보유 < 2년 + 중과)

| 보유기간 분기 | 단기세율 (`SHORT_TERM_RATE_*`) | 중과 미적용 | 중과 적용 |
|---|---|---|---|
| `under1y` | 70% | 70% 단일세율 산출 | **max(중과 누진세율 산출, 70% 단일세율 산출)** |
| `under2y` | 60% | 60% 단일세율 산출 | **max(중과 누진세율 산출, 60% 단일세율 산출)** |
| `over2y` | (해당 없음) | 누진세율 산출 | 중과 누진세율 산출 (§3-4) |

#### 3-5-2. 산출 산식 (보유 < 2년 + 중과)

```
short_term_tax = Math.floor(taxBase × SHORT_TERM_RATE)        // SHORT_TERM_RATE = 0.60 or 0.70
heavy_progressive_tax = (§3-4-1 산출, Math.floor 절사)
calculatedTax = max(short_term_tax, heavy_progressive_tax)
```

> v0.3-A는 본 단서를 포함한다. 미포함 시 보유 < 2년 케이스의 산출이 법령에 어긋나므로. 단서 처리는 단순한 max 비교라 추가 룩업 불요.

#### 3-5-3. `result.steps.appliedRate` 표시 (보유 < 2년 + 중과)

| 분기 | `appliedRate` 표시 |
|---|---|
| short_term_tax > heavy_progressive_tax | `{ type: 'short_term_60or70', rate: 0.60 or 0.70, comparedHeavy: true }` |
| heavy_progressive_tax >= short_term_tax | `{ type: 'progressive_with_heavy', bracket: {...}, addition: 0.20 or 0.30, comparedShort: true }` |

> 호출 측(`result_renderer.js` 등)이 어느 산식이 큰지 표시할 수 있도록 메타정보 보존.

### 3-6. issueFlag 카탈로그 (v0.3-A 신규 + 변경)

#### 3-6-1. 신규 issueFlag (5종)

| code | 발동 조건 | severity | lawRef | message 예시 |
|---|---|---|---|---|
| `HEAVY_TAXATION_APPLIED` | `isHeavyTaxationApplicable === true` | warning | 제104조 ⑦ | "다주택 중과세가 적용되었습니다 (가산세율 +N%p)." |
| `HEAVY_TAXATION_2_HOUSES` | `isHeavyTaxationApplicable && householdHouseCount === 2` | info | 제104조 ⑦ㆍ시행령 제167조의10 | "1세대 2주택 중과 +20%p가 적용되었습니다." |
| `HEAVY_TAXATION_3_HOUSES` | `isHeavyTaxationApplicable && householdHouseCount >= 3` | info | 제104조 ⑦ㆍ시행령 제167조의3 | "1세대 3주택 이상 중과 +30%p가 적용되었습니다." |
| `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` | `isHeavyTaxationApplicable && holdingYears >= 3` | info | 제95조 ② 단서 | "중과 대상 주택은 장기보유특별공제가 배제되었습니다 (보유 N년 무관)." |
| `HEAVY_TAX_SHORT_TERM_COMPARISON` | `isHeavyTaxationApplicable && holdingPeriodBranch !== 'over2y'` | info | 제104조 ⑦ 본문 단서 | "보유 2년 미만 + 중과 — 단기세율 산출세액과 비교하여 큰 세액을 적용했습니다." |

> 본 5종은 **v0.3-A 명세서 §6 카탈로그 추가**의 핵심. 검증팀이 발동 여부로 중과 메커니즘 검증 가능.

#### 3-6-2. 신규 보조 issueFlag (3종)

| code | 발동 조건 | severity | 목적 |
|---|---|---|---|
| `SALE_REGULATED_USER_INPUT` | 항상 (v0.3-A 활성 신규 입력) | info | 양도시 조정대상지역 판정은 사용자 책임 명시. 자동 판정은 post-MVP (B-033). |
| `HEAVY_TAX_EXCLUSION_NOT_HANDLED` | `isHeavyTaxationApplicable === true` | info | 장기임대주택 등 시행령 제167조의10·11 단서 (중과 배제 사유) v0.3-A 미처리. 전문가 검토 필요. |
| `HEAVY_TAX_TRANSITION_NOT_HANDLED` | `caseData.salePlan.contractDate < "2026-05-09"` (입력 시) | info | 강남3구·용산 한시 유예(계약 2026-05-09 이전 + 잔금 4개월 이내) v0.3-A 미처리. 본 입력 필드는 v0.3-A 미활성, post-MVP에서 활성화 예정 (B-023). |

> `HEAVY_TAX_TRANSITION_NOT_HANDLED`는 입력 필드 `contractDate`가 v0.3-A 입력 스키마에 없으므로 실제 발동 빈도 0. 본 issueFlag는 **post-MVP 인계 표시용**이며 v0.3-A 검증에 영향 없음.

#### 3-6-3. v0.2.1 issueFlag 변경 (1종)

| code | v0.2.1 동작 | v0.3-A 동작 |
|---|---|---|
| `OUT_OF_V01_SCOPE_REGULATED_AREA` | `saleRegulated === true`만 발동 | **개명 + 발동조건 변경**: `OUT_OF_V0X_SCOPE_REGULATED_AREA_AT_SALE` → **폐기** (v0.3-A는 saleRegulated 활성). v0.3-A 신규 케이스는 `SALE_REGULATED_USER_INPUT` (info)로 대체. v0.1 회귀 테스트가 본 코드 발동을 검증 중이면 §9-1 단서로 처리. |

> v0.2.1까지는 `saleRegulated === true` 입력이 "v0.x 범위 외" warning이었으나, v0.3-A에서는 **정상 입력**. 따라서 본 issueFlag는 폐기. 회귀 영향은 §9-1 단서 (b)로 처리.

#### 3-6-4. v0.3-A issueFlag 합계

```
v0.2.1: 18종 (유지 5 + 변경 5 + 신규 5 + 보조 3)
v0.3-A: 5(유지) + 5(변경, OUT_OF_V01_SCOPE_REGULATED_AREA 폐기) + 5(v0.2 신규) + 3(v0.2 보조) + 5(v0.3-A 신규) + 3(v0.3-A 보조) − 1(폐기) = 활성 25종
```

> 단, `HEAVY_TAX_TRANSITION_NOT_HANDLED`는 입력 필드(`contractDate`) 부재로 실제 발동 빈도 0. 활성 25종 중 실 발동 24종.

### 3-7. 단계 4·9 변경 후 결과 객체 신규 필드

`result.steps`에 v0.3-A 신규 필드 추가:

| 필드 | 타입 | 의미 | v0.2.1 → v0.3-A |
|---|---|---|---|
| **`isHeavyTaxation`** | boolean | 다주택 중과 적용 여부 | **신규** |
| **`heavyRateAddition`** | number \| null | 가산세율 (0.20·0.30·null) | **신규** |
| `appliedDeductionTable` | `1` \| `2` \| `null` | 적용 표 (중과 배제 시 `null`) | **의미 확장** (§3-3-2) |
| `appliedRate` | object | 단계 9 적용 세율 | **구조 확장**: 중과 시 `{ type: 'progressive_with_heavy', bracket, addition }`. 보유 < 2년 + 중과 시 §3-5-3 표 |
| **`shortTermTax`** | number \| null | 보유 < 2년 + 중과 비교용 단기세율 산출세액 | **신규** (보유 < 2년 + 중과 케이스만 채움, 그 외 `null`) |
| **`heavyProgressiveTax`** | number \| null | 보유 < 2년 + 중과 비교용 중과 누진세율 산출세액 | **신규** (보유 < 2년 + 중과 케이스만 채움, 그 외 `null`) |

---

## 4. 입력 스키마 변경 (v0.2.0 → v0.3-A)

### 4-1. caseData 최상위 구조 (변경 없음)

```js
caseData = {
  baseYear:           number,
  householdMembers:   number,
  basicDeductionUsed: boolean,
  houses:             House[],   // v0.3-A에서도 1개만 사용
  salePlan:           SalePlan
}
```

> v0.3-A는 단일 양도(`salePlan.candidateHouseIds.length === 1`)만 다룬다. 시나리오 엔진은 v0.3-B (별도 작업 창).

### 4-2. House 스키마 변경 (v0.3-A)

| 필드 | v0.2.0 상태 | v0.3-A 상태 |
|---|---|---|
| `acquisitionRegulated` | 활성 (거주요건 판정) | 동일 |
| `residenceMonths`, `livingNow` | 활성 | 동일 |
| **`saleRegulated`** | **보존 (입력은 받되 산식 미사용)** | **활성 (다주택 중과 판정)** |
| `nickname`, `location` | 결과 화면 표시 | 동일 |
| `specialTaxFlags`, `specialTaxRequirementsMet` | v0.6+ 활성 (자동 보정 7종) | 동일 |

#### 4-2-1. `saleRegulated` 활성 명세

| 항목 | 내용 |
|---|---|
| 입력 타입 | boolean |
| 활성 단계 | 단계 4 진입 직전 (다주택 중과 판정 — §3-1) |
| 자동 보정 | 누락 시 `false` 자동 보정 (v0.2 그대로) |
| issueFlag | `SALE_REGULATED_USER_INPUT` (info, 항상) |
| 자동 판정 | **v0.3-A 미적용** (사용자 직접 입력 가정). 자동 판정은 post-MVP (B-033 + B-021 통합). |

> **B-033 (자동 조정대상지역 판정)** post-MVP 인계 사유: (a) 조정대상지역 리스트는 시점별로 변경 (국토부 고시), (b) 법제처 OpenAPI 행정규칙 영역 통합 처리 권고 (B-021). v0.3-A는 사용자 직접 입력 가정이며 issueFlag로 사용자 책임 명시.

### 4-3. `householdHouseCount` 사용 패턴 (v0.3-A)

`householdHouseCount`는 v0.2부터 활성. v0.3-A는 추가 사용 패턴 도입.

| 사용처 | v0.2 | v0.3-A |
|---|---|---|
| 단계 2 — 1세대1주택 비과세 판정 | `=== 1` 비교 | 동일 |
| **단계 4 — 다주택 중과 판정** | (해당 없음) | **`>= 2` 비교 (조건 1)** |
| **단계 9 — 가산세율 룩업** | (해당 없음) | **`findHeavyTaxRateAddition(householdHouseCount)` 호출** |

> **3주택 이상 (`>= 3`)**: 시행령 제167조의3 ① "1세대 3주택 이상에 해당하는 주택"에 해당. 본 명세서는 `householdHouseCount >= 3`을 모두 3주택 이상 중과(+30%p)로 처리. 시행령 제167조의3 ① 단서(소형주택 산입 제외 등)는 v0.3-A 미처리 (issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` info로 표시).

### 4-4. salePlan 신규 필드 (v0.3-A 미활성, post-MVP 인계 표시)

| 필드 | 의미 | v0.3-A 활성 | 비고 |
|---|---|---|---|
| `contractDate` | 매매계약 체결일 | ❌ 미활성 | 강남3구·용산 한시 유예(2026-05-09 이전 계약 + 잔금 4개월 이내) 처리용. post-MVP B-023 통합. |

> v0.3-A는 `contractDate`를 입력 스키마에 추가하지 않는다. 본 표는 post-MVP 인계 표시용.

---

## 5. 결과 객체 구조 변경

### 5-1. `result.steps` 신규 필드 (v0.3-A)

§3-7 표에서 정의한 v0.3-A 신규 필드 4종을 `result.steps`에 추가:

| 필드 | 타입 | 의미 | terminateAt2=true 시 |
|---|---|---|---|
| `isHeavyTaxation` | boolean | 다주택 중과 적용 여부 | `false` |
| `heavyRateAddition` | number \| null | 가산세율 (`0.20`·`0.30`·`null`) | `null` |
| `shortTermTax` | number \| null | 보유 < 2년 + 중과 비교용 단기세율 산출세액 | `null` |
| `heavyProgressiveTax` | number \| null | 보유 < 2년 + 중과 비교용 중과 누진세율 산출세액 | `null` |

### 5-2. `result.steps.appliedDeductionTable` 의미 확장 (v0.3-A)

§3-3-2 표 그대로. `null`의 사유가 (a) 보유 < 3년 (b) 단계 2 종료 (c) **중과 배제** 3가지로 확장. 사유 구분은 issueFlag 발동으로 표시.

### 5-3. `result.steps.appliedRate` 구조 확장 (v0.3-A)

| 케이스 | `appliedRate` 구조 |
|---|---|
| 단계 2 종료 | `null` (v0.2.1 동일) |
| 보유 < 1년 (중과 미발동) | `{ type: 'short_term_70', rate: 0.70 }` (v0.1 동일) |
| 보유 < 2년 (중과 미발동) | `{ type: 'short_term_60', rate: 0.60 }` (v0.1 동일) |
| 보유 ≥ 2년 (중과 미발동) | `{ type: 'progressive', bracket: {...} }` (v0.1 동일) |
| **보유 ≥ 2년 (중과 발동)** | **`{ type: 'progressive_with_heavy', bracket: {...}, addition: 0.20 \| 0.30 }`** |
| **보유 < 2년 + 중과 (단기세율 우세)** | **`{ type: 'short_term_60or70_vs_heavy', rate: 0.60 \| 0.70, comparedHeavy: true, chosen: 'short_term' }`** |
| **보유 < 2년 + 중과 (중과 누진 우세)** | **`{ type: 'short_term_60or70_vs_heavy', rate: 0.60 \| 0.70, addition: 0.20 \| 0.30, comparedHeavy: true, chosen: 'heavy_progressive', bracket: {...} }`** |

> **호환성**: 호출 측(`result_renderer.js`)이 `appliedRate.type`으로 분기하면 v0.3-A 신규 케이스 처리 시 추가 분기만 작성하면 됨. v0.2.1 케이스는 그대로 표시.

### 5-4. 결과 객체 톱레벨 필드 (B-032 인계)

**B-032 처리**: v0.3-A 명세서는 v0.2.1 결과 객체 톱레벨 명세를 **그대로 따른다** (`totalTax`·`netAfterTaxSaleAmount`·`effectiveTaxRate` 톱레벨 명시). 

실제 v0.2 코드(`commit e36cb68`)는 `result.metrics.totalTax` + `result.steps.totalTax` (캡슐화) 구조로 톱레벨 부재. 본 명세서는 명세-코드 불일치를 v0.3-A 범위 외로 분리하고, 5/6 PRD 작성 시점 또는 v0.3-B 진입 시점에 별도 처리한다 (인계 1).

---

## 6. issueFlag 카탈로그 (v0.2.1 18종 → v0.3-A 25종)

### 6-1. 카탈로그 일람

| # | code | severity | v0.1/v0.2/v0.3-A | 발동 조건 (요약) |
|---|---|---|---|---|
| 1 | `OUT_OF_V01_SCOPE_DATE` | warning | v0.1 유지 | `saleDate < "2026-05-10"` |
| 2 | `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | v0.1 유지 | 항상 |
| 3 | `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | v0.1 유지 | 항상 |
| 4 | `HOLDING_PERIOD_BOUNDARY` | info | v0.1 유지 (v0.2 확장) | 1·2·3·15년 마크 ±3일 |
| 5 | `TRANSFER_LOSS_DETECTED` | info | v0.1 유지 | `transferGain < 0` |
| 6 | `LONG_TERM_DEDUCTION_NOT_APPLIED` | (폐기) | v0.2 폐기 | (미발동) |
| 7 | `POSSIBLE_NON_TAXATION_1H1H` | info | v0.2 변경 | 비과세 미적용 + 1주택 + 보유 ≥ 2 + 거주 ≥ 24M |
| 8 | `HIGH_VALUE_HOUSE` | info | v0.2 변경 | 비과세 미적용 + salePrice ≥ 12억 |
| 9 | ~~`OUT_OF_V01_SCOPE_REGULATED_AREA`~~ | (폐기) | **v0.3-A 폐기** | (미발동) |
| 10 | `UNREGISTERED_RATE_NOT_APPLIED` | info | v0.2 변경 (이름) | 항상 |
| 11 | `IS_1SE_1HOUSE` | info | v0.2 신규 | 단계 2 결과 `is1Se1House === true` |
| 12 | `IS_HIGH_VALUE_HOUSE` | info | v0.2 신규 | 비과세 + salePrice ≥ 12억 |
| 13 | `LONG_TERM_DEDUCTION_TABLE_1` | info | v0.2 신규 | `appliedDeductionTable === 1` |
| 14 | `LONG_TERM_DEDUCTION_TABLE_2` | info | v0.2 신규 | `appliedDeductionTable === 2` |
| 15 | `ONE_TIME_2HOUSES_NOT_APPLIED` | warning | v0.2 신규 | `caseData.isOneTimeTwoHouses === true` |
| 16 | `RESIDENCE_MONTHS_USER_INPUT` | info | v0.2 보조 | 항상 |
| 17 | `RESIDENCE_EXEMPTION_NOT_HANDLED` | info | v0.2 보조 | `acquisitionRegulated && residenceMonths < 24` |
| 18 | `LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2` | info | v0.2 보조 | 비과세 + 12억 초과 + 보유 < 3년 |
| **19** | **`HEAVY_TAXATION_APPLIED`** | **warning** | **v0.3-A 신규** | **다주택 중과 4단계 조건 모두 충족** |
| **20** | **`HEAVY_TAXATION_2_HOUSES`** | **info** | **v0.3-A 신규** | **중과 + householdHouseCount === 2** |
| **21** | **`HEAVY_TAXATION_3_HOUSES`** | **info** | **v0.3-A 신규** | **중과 + householdHouseCount >= 3** |
| **22** | **`LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY`** | **info** | **v0.3-A 신규** | **중과 + holdingYears >= 3** |
| **23** | **`HEAVY_TAX_SHORT_TERM_COMPARISON`** | **info** | **v0.3-A 신규** | **중과 + holdingPeriodBranch !== 'over2y'** |
| **24** | **`SALE_REGULATED_USER_INPUT`** | **info** | **v0.3-A 보조** | **항상 (양도시 조정대상지역 입력 책임 명시)** |
| **25** | **`HEAVY_TAX_EXCLUSION_NOT_HANDLED`** | **info** | **v0.3-A 보조** | **중과 발동 시 (장기임대주택 등 제외 사유 미처리 안내)** |
| 26 | `HEAVY_TAX_TRANSITION_NOT_HANDLED` | info | v0.3-A 보조 | (입력 필드 부재로 실제 발동 빈도 0, post-MVP 인계 표시용) |

### 6-2. v0.3-A 카탈로그 요약 합계

```
유지: 4 (1, 2, 3, 4, 5에서 OUT_OF_V01_SCOPE_REGULATED_AREA 폐기로 4)
v0.2 변경: 4 (UNREGISTERED_RATE_NOT_APPLIED, POSSIBLE_NON_TAXATION_1H1H, HIGH_VALUE_HOUSE; LONG_TERM_DEDUCTION_NOT_APPLIED 폐기)
v0.2 신규: 5 (IS_1SE_1HOUSE, IS_HIGH_VALUE_HOUSE, LONG_TERM_DEDUCTION_TABLE_1/2, ONE_TIME_2HOUSES_NOT_APPLIED)
v0.2 보조: 3 (RESIDENCE_MONTHS_USER_INPUT, RESIDENCE_EXEMPTION_NOT_HANDLED, LONG_TERM_DEDUCTION_HOLDING_LESS_THAN_3Y_FOR_TABLE_2)
v0.3-A 신규: 5 (HEAVY_TAXATION_APPLIED, HEAVY_TAXATION_2/3_HOUSES, LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY, HEAVY_TAX_SHORT_TERM_COMPARISON)
v0.3-A 보조: 3 (SALE_REGULATED_USER_INPUT, HEAVY_TAX_EXCLUSION_NOT_HANDLED, HEAVY_TAX_TRANSITION_NOT_HANDLED)
─────────────────
활성 25종 (실 발동 24종, HEAVY_TAX_TRANSITION_NOT_HANDLED은 입력 필드 부재로 빈도 0)
```

### 6-3. `intermediates` 입력 보강 (v0.3-A)

`collectIssueFlags(caseData, intermediates)`의 `intermediates` 입력에 v0.3-A 신규 필드 2종 추가:

| 필드 | 출처 | 용도 |
|---|---|---|
| `isHeavyTaxation` | 단계 4 | `HEAVY_TAXATION_APPLIED`·`HEAVY_TAXATION_2_HOUSES`·`HEAVY_TAXATION_3_HOUSES`·`LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY`·`HEAVY_TAX_SHORT_TERM_COMPARISON`·`HEAVY_TAX_EXCLUSION_NOT_HANDLED` 분기 |
| `heavyRateAddition` | 단계 4 | `HEAVY_TAXATION_APPLIED` message 채움 (가산세율 +N%p) |

---

## 7. 절사 처리 (v0.2.1 그대로)

### 7-1. 절사 위치 일람

| 단계 | 변수 | 절사 | v0.3-A 변경 |
|---|---|---|---|
| 3 | `taxableGain` (안분 후) | `Math.floor(transferGain × allocationRatio)` | 동일 |
| 4 | `longTermDeduction` | `Math.floor(taxableGain × totalRate)` (중과 시 0) | 동일 (중과 시 0이므로 절사 불요) |
| 9 | `calculatedTax` (단기세율) | `Math.floor(taxBase × SHORT_TERM_RATE)` | 동일 |
| 9 | `calculatedTax` (누진세율) | `Math.floor(baseTax + (taxBase − lowerBound) × marginalRate)` | **변경**: 중과 시 `Math.floor(baseTax_with_addition + (taxBase − lowerBound) × (marginalRate + addition))` |
| **9** | **`shortTermTax`** | **`Math.floor(taxBase × SHORT_TERM_RATE)`** | **신규** (보유 < 2년 + 중과 비교용) |
| **9** | **`heavyProgressiveTax`** | **`Math.floor(...)` (§3-4-1 산식)** | **신규** (보유 < 2년 + 중과 비교용) |
| 11 | `localIncomeTax` | `Math.floor(calculatedTax × 0.1)` | 동일 (중과 후 calculatedTax에 적용) |

### 7-2. 절사 정책

- 비율 변수(`addition`·`allocationRatio`·`holdingRate`·`residenceRate`·`totalRate`)는 절사하지 않음 (비율은 정확값 유지)
- 누적 세액 계산 시 중간 절사 없음 (한 번의 `Math.floor`로 단계 9 마무리)
- `baseTax_with_addition` 계산은 산식 흐름이므로 절사 없이 누적

### 7-3. B-022 (정수 처리 — 절사 vs 반올림) — v0.3-A 무영향

v0.2.1에서 식별된 1원 단위 차이(검증팀·Claude `Math.floor` vs 홈택스 반올림 추정)는 v0.3-A에서도 동일하게 `Math.floor` 두 번 절사 그대로 유지. 향후 모의계산상 반올림 정당성 확인 시 산식 정정 (B-022 백로그 처리 시점).

---

## 8. 입력 검증 (v0.2.1 그대로 + saleRegulated 활성)

### 8-1. v0.2 검증 항목 13종 (변경 없음)

§7-2 v0.2.1 그대로. `saleRegulated`는 누락 시 `false` 자동 보정 (v0.2 그대로).

### 8-2. v0.3-A 신규 검증 항목 (없음)

v0.3-A는 입력 스키마에 신규 필드를 추가하지 않는다 (`contractDate`는 post-MVP 인계). 따라서 신규 검증 항목 없음.

### 8-3. 자동 보정 룰 (B-019, v0.2.1 §7-3 그대로)

| 필드 | 누락 시 자동 보정값 | issueFlag |
|---|---|---|
| `householdHouseCount` | `salePlan.candidateHouseIds.length`로 추정 | `HOUSEHOLD_COUNT_INFERRED` (info) |
| `isOneTimeTwoHouses` | `false` | 없음 |
| `livingNow` | `false` | 없음 |
| `acquisitionRegulated` | `false` | 없음 |
| `residenceMonths` | `0` | `RESIDENCE_MONTHS_DEFAULTED_ZERO` (info) |
| `saleRegulated` | `false` | 없음 (`SALE_REGULATED_USER_INPUT`은 항상 발동, 별개) |
| `specialTaxFlags`, `specialTaxRequirementsMet` | 기본값 | 없음 |

> **`saleRegulated` 자동 보정 = `false`**: v0.3-A에서 활성화되었지만 누락 시 비조정대상 가정 (중과 미발동). v0.1 회귀 테스트의 입력은 `saleRegulated` 미입력 → 자동 보정 `false` → 중과 미발동 → v0.1 결과 보존.

---

## 9. 호출 측 의존 변경 (`tax_rules.js` v0.3-A 신규)

### 9-1. v0.3-A `tax_rules.js` 신규 노출 (3종)

| 멤버 | 타입 | 역할 | 비고 |
|---|---|---|---|
| `HEAVY_TAX_RATE_ADDITION` | array | 다주택 중과 가산세율 룩업 (2주택·3주택) | §3-2-1 |
| `findHeavyTaxRateAddition(houseCount)` | function | 가산세율 룩업 함수 | §3-2-2 |
| `LAW_REFS["제104조 ⑦"]` | string | 다주택 중과 본조 라벨 | 신규 키 추가 |

> `RULE_VERSION` 갱신: `"v0.2.0-post-20260510"` → `"v0.3.0-post-20260510"` 권장 (Claude Code 결정).

### 9-2. v0.3-A `tax_rules.js` 노출 멤버 합계

```
v0.2.0: 24종 (v0.1 17 + v0.2 신규 7)
v0.3-A 추가: 2종 (HEAVY_TAX_RATE_ADDITION + findHeavyTaxRateAddition)
v0.3-A 합계: 26종
```

> `LAW_REFS` 키 추가는 노출 멤버 수 증가에 포함하지 않음 (v0.1.1 그대로 1종으로 카운트).

### 9-3. `tax_engine.js` v0.3-A 사용 멤버 보강

§4-3 표에 다음 추가:

| `tax_engine.js` 단계 | v0.3-A 사용 멤버 | 비고 |
|---|---|---|
| **단계 4 (장특공)** | **`HEAVY_TAX_RATE_ADDITION` (간접 — 중과 발동 분기 조건만)** | 가산세율 자체는 단계 9에서 호출 |
| **단계 9 (세율 적용)** | **`findHeavyTaxRateAddition(houseCount)` 호출** | 중과 적용 시 가산세율 획득 |
| 단계 9 (보유 < 2년 + 중과) | `SHORT_TERM_RATE_UNDER_1Y`, `SHORT_TERM_RATE_UNDER_2Y` (v0.1 그대로) + `findBracket` (v0.1 그대로) + `findHeavyTaxRateAddition` (v0.3-A 신규) | max 비교 |
| issueFlag 수집 | 변경 없음 (`LAW_REFS` 신규 키만 사용 가능) | — |

### 9-4. 부트스트랩 가드 (v0.3-A 추가)

`tax_engine.js`는 `tax_rules.js` v0.3-A의 신규 멤버 부재 시 silent failure를 방지하기 위한 가드 추가:

```js
if (typeof window.TaxOpt.taxRules.findHeavyTaxRateAddition !== 'function' ||
    !Array.isArray(window.TaxOpt.taxRules.HEAVY_TAX_RATE_ADDITION)) {
  throw new Error('tax_engine v0.3-A: tax_rules v0.3-A (HEAVY_TAX_RATE_ADDITION 등) 미로드.');
}
```

`tax_rules.js`가 v0.2.0 상태로 남고 `tax_engine.js`만 v0.3-A로 갱신된 경우의 silent failure 방지.

---

## 10. 골든셋 (v0.3-A)

### 10-1. v0.1·v0.2 골든셋 회귀 보존 (TC-001~010 10건)

v0.3-A 코드는 다음 10개 골든셋을 **그대로 통과해야** 한다.

#### 10-1-1. v0.1 골든셋 TC-001~005 (saleRegulated=false 회귀)

| TC | salePrice | 보유 | totalTax (v0.1 정답값) | v0.3-A 결과 |
|---|---|---|---|---|
| TC-001 | 8억 | 6년 7개월 | 98,241,000 | **동일 (saleRegulated=false 자동 보정 → 중과 미발동)** |
| TC-002 | 7억 | 1년 7개월 | 61,050,000 | 동일 |
| TC-003 | 4.8억 | 6년 4개월 | 0 | 동일 |
| TC-004 | 8억 | 6년 7개월 | 99,286,000 | 동일 |
| TC-005 | 2.165억 | 8년 4개월 | 924,000 | 동일 |

> v0.2.1 명세서 §9-1의 입력 패치(`householdHouseCount: 2`) 권고 그대로 유지. v0.1 골든셋은 `saleRegulated` 미입력 → 자동 보정 `false` → 중과 미발동 (조건 2 미충족).

#### 10-1-2. v0.2 골든셋 TC-006~010 (saleRegulated=false 회귀)

| TC | 의도 | 1세대1주택 | salePrice | totalTax (v0.2 정답값) | v0.3-A 결과 |
|---|---|---|---|---|---|
| TC-006 | 1세대1주택 비과세 + 12억 이하 | YES | 10억 | 0 | 동일 (조건 4 미충족) |
| TC-007 | 1세대1주택 + 12억 초과 (안분 + 표 2 64%) | YES | 15억 | 6,161,100 | 동일 (조건 4 미충족) |
| TC-008 | 다주택 일반과세 + 표 1 24% | NO | 10억 | 130,878,000 | **동일 (saleRegulated=false → 조건 2 미충족)** |
| TC-009 | 1세대1주택 + 표 2 80% (안분 + 14억) | YES | 14억 | 1,383,642 | 동일 (조건 4 미충족) |
| TC-010 | 일시적 2주택 (다주택 일반과세) | NO | 10억 | 122,826,000 | **동일 (saleRegulated=false → 조건 2 미충족)** |

> v0.2 골든셋의 `saleRegulated`는 모두 `false`로 명시 입력. 따라서 v0.3-A에서도 중과 발동 조건 미충족, 결과 변경 없음.

### 10-2. v0.3-A 신규 골든셋 (TC-011 ~ TC-014, 검증 대기)

본 절은 검증팀(설하영·이준기·김태환·김두섭) 손계산 + 국세청 홈택스 모의계산 가능 형태로 작성.

#### 10-2-1. TC-011 — 2주택 + saleRegulated=true (중과 +20%p + 장특공 배제)

##### 10-2-1-1. 입력

| 필드 | 값 | 비고 |
|---|---|---|
| `baseYear` | 2026 | |
| `basicDeductionUsed` | false | |
| **`householdHouseCount`** | **2** | 다주택 |
| `isOneTimeTwoHouses` | false | |
| `houses[0].id` | "A" | |
| `houses[0].acquisitionDate` | 2014-05-20 | TC-008과 동일 (보유 12년) |
| `houses[0].acquisitionPrice` | 500,000,000 | TC-008과 동일 |
| `houses[0].necessaryExpense` | 20,000,000 | TC-008과 동일 |
| `houses[0].acquisitionRegulated` | false | |
| `houses[0].residenceMonths` | 0 | 거주 안 함 |
| `houses[0].livingNow` | false | |
| `houses[0].expectedSaleDate` | 2026-08-15 | 중과 유예 종료 후 |
| `houses[0].expectedSalePrice` | 1,000,000,000 | TC-008과 동일 (10억) |
| **`houses[0].saleRegulated`** | **true** | **양도시 조정대상지역 → 중과 발동** |

> **TC-008과 비교**: `saleRegulated`만 `false → true` 변경. 중과 +20%p 발동 + 장특공 배제 효과를 검증.

##### 10-2-1-2. 단계별 기대값

| 단계 | 변수 | 기대값 | 산식 |
|---|---|---|---|
| 1 | `transferGain` | 480,000,000 | 1,000,000,000 − 500,000,000 − 20,000,000 |
| 2 | `is1Se1House` | false | householdHouseCount=2 |
|   | `taxableGain` | 480,000,000 | passthrough |
| 3 | `taxableGain` | 480,000,000 | 안분 미적용 |
| **4** | **`isHeavyTaxation`** | **true** | 4단계 조건 모두 충족 |
|   | **`heavyRateAddition`** | **0.20** | 2주택 |
|   | `holdingYears` | 12 | 2014-05-20 → 2026-08-15 |
|   | **`appliedDeductionTable`** | **null** | **중과 배제** |
|   | **`longTermDeduction`** | **0** | **중과 → 표 1·2 모두 배제 (제95조 ② 단서)** |
| 5 | `capitalGainIncome` | 480,000,000 | 480,000,000 − 0 |
| 6 | `basicDeduction` | 2,500,000 | basicDeductionUsed=false |
| 7 | `taxBase` | **477,500,000** | 480,000,000 − 2,500,000 |
| 8 | `holdingPeriodBranch` | "over2y" | 보유 12년 |
| **9** | `appliedRate.bracket` | 3억 초과 ~ 5억 이하 (40%) | findBracket(477,500,000) |
|   | **`appliedRate.addition`** | **0.20** | 가산세율 |
|   | baseTax (기본) | 94,060,000 | 누진세율표 그대로 |
|   | **baseTax_with_addition (3억 lowerBound까지)** | **154,060,000** | §3-4-3 표 |
|   | **`calculatedTax`** | **260,560,000** ⏳ | **154,060,000 + (477,500,000 − 300,000,000) × (0.40 + 0.20) = 154,060,000 + 106,500,000** |
| 11 | `localIncomeTax` | **26,056,000** ⏳ | floor(260,560,000 × 0.1) |
| 12 | **`totalTax`** | **286,616,000** ⏳ | 검증 대기 |
| 13 | `netAfterTaxSaleAmount` | **713,384,000** ⏳ | 1,000,000,000 − 286,616,000 |

##### 10-2-1-3. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| `HEAVY_TAXATION_APPLIED` | warning | ✅ |
| `HEAVY_TAXATION_2_HOUSES` | info | ✅ |
| `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` | info | ✅ (보유 12년 무관 배제) |
| `SALE_REGULATED_USER_INPUT` | info | ✅ |
| `HEAVY_TAX_EXCLUSION_NOT_HANDLED` | info | ✅ |
| `RESIDENCE_MONTHS_USER_INPUT` | info | ✅ |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | info | ✅ |
| `UNREGISTERED_RATE_NOT_APPLIED` | info | ✅ |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | info | ✅ |
| `LONG_TERM_DEDUCTION_TABLE_1` | info | ❌ (중과 배제) |

##### 10-2-1-4. 검증 의도

- TC-008과 비교: `saleRegulated`만 변경 → 중과 +20%p 발동 + 장특공 배제 → totalTax 130,878,000 → 286,616,000 (**약 2.19배 증가**)
- 산식 검증: 누진 구간 누적 baseTax_with_addition + (taxBase − lowerBound) × (marginalRate + addition)
- 검증팀: 손계산 + 홈택스 모의계산 (홈택스는 다주택 중과 분기 자동 처리). 담당자 미정.

#### 10-2-2. TC-012 — 3주택 + saleRegulated=true (중과 +30%p)

##### 10-2-2-1. 입력

| 필드 | 값 | 비고 |
|---|---|---|
| `baseYear` | 2026 | |
| `basicDeductionUsed` | false | |
| **`householdHouseCount`** | **3** | **3주택 (중과 +30%p)** |
| `isOneTimeTwoHouses` | false | |
| `houses[0]` | (TC-011과 동일) | |
| **`houses[0].saleRegulated`** | **true** | |

> **TC-011과 비교**: `householdHouseCount`만 `2 → 3` 변경. +30%p 가산 효과 검증.

##### 10-2-2-2. 단계별 기대값

| 단계 | 변수 | 기대값 | 산식 |
|---|---|---|---|
| 1 | `transferGain` | 480,000,000 | (TC-011과 동일) |
| 2 | `is1Se1House` | false | |
| 3 | `taxableGain` | 480,000,000 | |
| 4 | `isHeavyTaxation` | true | |
|   | **`heavyRateAddition`** | **0.30** | **3주택 클램프** |
|   | `appliedDeductionTable` | null | 중과 배제 |
|   | `longTermDeduction` | 0 | |
| 5 | `capitalGainIncome` | 480,000,000 | |
| 6 | `basicDeduction` | 2,500,000 | |
| 7 | `taxBase` | 477,500,000 | |
| 8 | `holdingPeriodBranch` | "over2y" | |
| 9 | bracket | 3억 초과 ~ 5억 이하 (40%) | |
|   | addition | 0.30 | |
|   | **baseTax_with_addition (3억 lowerBound까지)** | **184,060,000** | §3-4-3 표 (+30%p 누적) |
|   | **`calculatedTax`** | **308,310,000** ⏳ | **184,060,000 + (477,500,000 − 300,000,000) × (0.40 + 0.30) = 184,060,000 + 124,250,000** |
| 11 | `localIncomeTax` | **30,831,000** ⏳ | floor(308,310,000 × 0.1) |
| 12 | **`totalTax`** | **339,141,000** ⏳ | 검증 대기 |
| 13 | `netAfterTaxSaleAmount` | **660,859,000** ⏳ | 1,000,000,000 − 339,141,000 |

##### 10-2-2-3. issueFlag (기대 발동)

| code | severity | 발동 |
|---|---|---|
| `HEAVY_TAXATION_APPLIED` | warning | ✅ |
| **`HEAVY_TAXATION_3_HOUSES`** | **info** | **✅ (3주택)** |
| `HEAVY_TAXATION_2_HOUSES` | info | ❌ (3주택 분기) |
| `LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY` | info | ✅ |
| `SALE_REGULATED_USER_INPUT` | info | ✅ |
| `HEAVY_TAX_EXCLUSION_NOT_HANDLED` | info | ✅ |
| (보조 4종) | info | ✅ (TC-011과 동일) |

##### 10-2-2-4. 검증 의도

- TC-011 (+20%p) vs TC-012 (+30%p) 비교: totalTax 286,616,000 → 339,141,000 (**약 +52,525,000 증가**)
- 가산세율 룩업 클램프 검증: `householdHouseCount = 3` 입력 → `findHeavyTaxRateAddition` 클램프 동작 → addition = 0.30
- 검증팀: 손계산 + 홈택스 모의계산. 담당자 미정.

#### 10-2-3. TC-013 — 2주택 + saleRegulated=false (중과 미발동, v0.2 회귀 안전성 확인)

##### 10-2-3-1. 입력

| 필드 | 값 | 비고 |
|---|---|---|
| (TC-008과 완전 동일) | | **TC-008 = TC-013** |
| `householdHouseCount` | 2 | |
| `saleRegulated` | **false** | **TC-011과 다름. 중과 미발동.** |

##### 10-2-3-2. 단계별 기대값

| 단계 | 기대값 | 비고 |
|---|---|---|
| 4 | `isHeavyTaxation = false` | **조건 2 미충족** (saleRegulated=false) |
|   | `heavyRateAddition = null` | |
|   | `appliedDeductionTable = 1` | 표 1 적용 (보유 12년 → 24%) |
|   | `longTermDeduction = 115,200,000` | TC-008과 동일 |
| 9 | `appliedRate.type = 'progressive'` | 중과 가산 없음 |
|   | `calculatedTax = 118,980,000` | TC-008과 동일 |
| 12 | **`totalTax = 130,878,000`** ✅ | **TC-008과 완전 동일** |

##### 10-2-3-3. 검증 의도 (가장 중요)

- **v0.2 회귀 안전성 검증**: `saleRegulated=false` 케이스에서 v0.3-A 코드가 v0.2 결과를 그대로 보존하는지 확인. 중과 4단계 조건 중 조건 2 단독으로 차단되는 케이스.
- TC-008은 v0.3-A 명세서에서 TC-013으로 재명명하여 명시적 검증 케이스화. 골든셋 일람표에 v0.2 회귀 케이스로 분류.
- **본 케이스가 깨지면 v0.2 → v0.3-A 마이그레이션 실패** → 즉시 롤백.

#### 10-2-4. TC-014 — 3주택 + saleRegulated=false (회귀, 보강)

##### 10-2-4-1. 입력

| 필드 | 값 | 비고 |
|---|---|---|
| (TC-008·013과 거의 동일) | | |
| **`householdHouseCount`** | **3** | **3주택** |
| **`saleRegulated`** | **false** | **중과 미발동 (조건 2 미충족)** |

##### 10-2-4-2. 단계별 기대값

| 단계 | 기대값 | 비고 |
|---|---|---|
| 4 | `isHeavyTaxation = false` | 조건 2 미충족 |
|   | `appliedDeductionTable = 1` | 다주택 일반과세 + 보유 12년 → 표 1 24% |
|   | `longTermDeduction = 115,200,000` | TC-008과 동일 |
| 12 | **`totalTax = 130,878,000`** ⏳ | **TC-008·013과 동일** (3주택이지만 saleRegulated=false → 중과 미발동) |

##### 10-2-4-3. 검증 의도

- **3주택 + 비조정대상 회귀 케이스**: 다주택 보유 자체가 아닌 `saleRegulated`가 중과의 키임을 검증. `householdHouseCount = 3`이라도 `saleRegulated=false`면 일반과세.
- 표 1 적용 (다주택 + 보유 ≥ 3년).
- 검증팀: TC-008과 동일하게 손계산 + 홈택스 모의계산. 담당자 미정.

### 10-3. 검증팀 결정 권고 — 추가 골든셋 후보 (TC-015~)

다음 케이스는 검증팀 검토 후 결정. 본 명세서는 권고만 명시.

| TC 후보 | 의도 | 입력 핵심 | 우선순위 |
|---|---|---|---|
| TC-015 | 2주택 보유 < 2년 + 중과 (단기세율 vs 중과 누진 max 비교) | 보유 1.5년 + saleRegulated=true + 다주택 2 | 권고 |
| TC-016 | 2주택 + saleRegulated=true + 보유 5년 (TC-010 확장) | TC-010 + saleRegulated=true | 권고 |
| TC-017 | 2주택 + saleRegulated=true + 1억 미만 과세표준 | 저액 케이스 (1구간) | 보강 |
| TC-018 | 3주택 + saleRegulated=true + 10억 초과 과세표준 (최고세율 75% 검증) | 최고세율 케이스 | 보강 |

> **TC-015는 §3-5 단서(보유 < 2년 + 중과)의 max 비교 검증에 핵심**이며 검증팀 권고 우선순위 최상. 본 명세서 v0.3-A는 산식 명시(§3-5)만 하고 정답값 산출은 검증팀 손계산 + Claude Code 작성 후 결정.

### 10-4. 골든셋 일람표 (v0.3-A 후보 5건 + 회귀 5건)

| TC | 의도 | saleRegulated | householdHouseCount | 보유 | 중과 발동 | 기대 totalTax | 회귀/신규 |
|---|---|---|---|---|---|---|---|
| TC-001~005 | v0.1 일반과세 5건 | false | 2 (자동 보정) | 1.5~8년 | ❌ | (v0.1 정답값) | 회귀 |
| TC-006 | 1세대1주택 비과세 | false | 1 | 5년 | ❌ | 0 | v0.2 회귀 |
| TC-007 | 1세대1주택 + 안분 + 표 2 | false | 1 | 8년 | ❌ | 6,161,100 | v0.2 회귀 |
| TC-008 | 다주택 일반 + 표 1 24% | false | 2 | 12년 | ❌ | 130,878,000 | v0.2 회귀 |
| TC-009 | 1세대1주택 + 안분 + 표 2 80% | false | 1 | 10년 | ❌ | 1,383,642 | v0.2 회귀 |
| TC-010 | 일시적 2주택 (다주택) | false | 2 | 5년 | ❌ | 122,826,000 | v0.2 회귀 |
| **TC-011** | **2주택 + 중과 +20%p + 장특공 배제** | **true** | **2** | **12년** | **✅** | **286,616,000 ⏳** | **v0.3-A 신규** |
| **TC-012** | **3주택 + 중과 +30%p** | **true** | **3** | **12년** | **✅** | **339,141,000 ⏳** | **v0.3-A 신규** |
| **TC-013** | **2주택 + saleRegulated=false (회귀)** | **false** | **2** | **12년** | **❌** | **130,878,000 (=TC-008)** | **v0.3-A 회귀** |
| **TC-014** | **3주택 + saleRegulated=false (회귀)** | **false** | **3** | **12년** | **❌** | **130,878,000** | **v0.3-A 회귀** |

⏳ = 검증 대기. 검증팀 손계산 + 홈택스 모의계산 후 정답값 확정.

---

## 11. 검증 방법론 (v0.2.1 KPI 100% 보존)

### 11-1. 5자 일치 KPI

v0.2.1과 동일한 5자 일치 검증 체계 유지:

1. **검증팀 손계산** (설하영·이준기·김태환·김두섭) — TC-011·012·013·014
2. **Claude 명세서 산출** (본 §10-2) — Claude 추정값 (검증 대기)
3. **국세청 홈택스 모의계산** — 5건 모두 모의계산 가능 확인
4. **Claude Code Node.js 회귀** — `tests/tax_engine.test.js` v0.3-A 신규 그룹
5. **GitHub Pages 라이브 검증** — `https://ds7style.github.io/taxopt/index.html` 콘솔

KPI: 5자 모두 totalTax 일치.

### 11-2. 회귀 안전성 검증 (절대 깨지면 안 됨)

| 검증 항목 | v0.3-A 결과 |
|---|---|
| TC-001~005 (v0.1 회귀, saleRegulated 미입력 → 자동 false) | totalTax 5건 모두 v0.1 정답값 그대로 |
| TC-006~010 (v0.2 회귀, saleRegulated=false 명시) | totalTax 5건 모두 v0.2 정답값 그대로 |
| Node.js 회귀 (v0.1 234건 + v0.2 신규) | 모두 통과 (RULE_VERSION 1라인 갱신 예외 인정) |
| GitHub Pages 라이브 (TC-001·006·008·010 등) | 모두 통과 |

> **회귀 깨지면 즉시 롤백**: v0.3-A 코드가 v0.2 코드의 결과를 보존하지 못하면 v0.3-A 마이그레이션 실패. 의사결정 #11 (정확성 > 속도)에 따라 롤백 + 원인 분석.

### 11-3. v0.3-A 신규 검증 (TC-011·012·013·014)

| TC | 검증 방법 |
|---|---|
| TC-011 (2주택 중과) | 검증팀 손계산 + 홈택스 모의계산 + Claude Code Node.js + GitHub Pages |
| TC-012 (3주택 중과) | 동일 |
| TC-013 (2주택 비조정 회귀) | TC-008 결과 일치 확인 |
| TC-014 (3주택 비조정 회귀) | TC-008 결과 일치 확인 |

### 11-4. 자동 테스트 변환 가이드 (v0.2.1 §10 패턴)

```js
const TC_GOLDEN_V03A = [
  {
    id: "TC-011",
    intent: "2주택 + saleRegulated=true (중과 +20%p + 장특공 배제)",
    input: {
      baseYear: 2026,
      basicDeductionUsed: false,
      householdHouseCount: 2,
      isOneTimeTwoHouses: false,
      houses: [{
        id: "A",
        acquisitionDate: "2014-05-20",
        acquisitionPrice: 500_000_000,
        necessaryExpense: 20_000_000,
        acquisitionRegulated: false,
        residenceMonths: 0,
        livingNow: false,
        expectedSaleDate: "2026-08-15",
        expectedSalePrice: 1_000_000_000,
        saleRegulated: true   // ← v0.3-A 활성
      }],
      salePlan: { candidateHouseIds: ["A"] }
    },
    expected: {
      transferGain:           480_000_000,
      taxableGain:            480_000_000,
      is1Se1House:                  false,
      isHeavyTaxation:               true,   // v0.3-A 신규
      heavyRateAddition:             0.20,   // v0.3-A 신규
      appliedDeductionTable:         null,   // 중과 배제
      longTermDeduction:                0,   // 중과 배제
      capitalGainIncome:      480_000_000,
      basicDeduction:           2_500_000,
      taxBase:                477_500_000,
      calculatedTax:          260_560_000,   // ⏳ 검증 대기
      localIncomeTax:          26_056_000,
      totalTax:               286_616_000,   // ⏳ 검증 대기
      netAfterTaxSaleAmount:  713_384_000
    },
    expectedIssueFlags: [
      "HEAVY_TAXATION_APPLIED",
      "HEAVY_TAXATION_2_HOUSES",
      "LONG_TERM_DEDUCTION_EXCLUDED_BY_MULTI_HOUSE_HEAVY",
      "SALE_REGULATED_USER_INPUT",
      "HEAVY_TAX_EXCLUSION_NOT_HANDLED",
      "RESIDENCE_MONTHS_USER_INPUT",
      "NECESSARY_EXPENSE_BREAKDOWN_MISSING",
      "UNREGISTERED_RATE_NOT_APPLIED",
      "ACQUISITION_CAUSE_ASSUMED_PURCHASE"
    ]
  },
  // TC-012 ~ TC-014 동일 패턴
];
```

상세 구현은 v0.3-A 코드 작업지시서(`docs/05_code_work_orders/05_tax_engine_v0_3_a.md` 예정, 작업 창 #11+)에서 확정.

---

## 12. v0.2.1 → v0.3-A 변경 요약

### 12-1. 본문 변경 영역

| 영역 | v0.2.1 | v0.3-A | 변경 사유 |
|---|---|---|---|
| §1 적용 범위 | v0.2 활성 (비과세·안분·장특공) | + 다주택 중과 + saleRegulated 활성 | 본 작업의 본질 |
| §2 13단계 파이프라인 | 13단계 골격 + 단계 4 활성 | 13단계 골격 + **단계 4·9 변경** | 중과 분기 추가 |
| §3 (신설) | (해당 없음) | **다주택 중과 판정 메커니즘 (4단계 조건 + 가산세율 룩업 + 장특공 배제 + 단기세율 비교)** | 본 작업의 본질 |
| §4 입력 스키마 | saleRegulated 보존 | **saleRegulated 활성** | 다주택 중과 판정용 |
| §5 결과 객체 | 18종 issueFlag + steps 10종 | + **isHeavyTaxation·heavyRateAddition·shortTermTax·heavyProgressiveTax** | 중과 결과 표시 |
| §6 issueFlag 카탈로그 | 18종 | **25종 (v0.3-A 신규 5 + 보조 3 − OUT_OF_V01_SCOPE_REGULATED_AREA 폐기)** | 중과 메커니즘 검증용 |
| §7 절사 | v0.1 그대로 | + **단계 9 중과 누진 산출 절사** | 중과 산식 |
| §8 입력 검증 | v0.2 13종 | 동일 (자동 보정 룰 그대로) | 신규 입력 필드 없음 |
| §9 호출 측 의존 | v0.2 24종 | + **HEAVY_TAX_RATE_ADDITION + findHeavyTaxRateAddition (26종)** | 가산세율 룩업 |
| §10 골든셋 | TC-006~010 5건 | + **TC-011·012·013·014 4건** | v0.3-A 검증 |
| §11 검증 | KPI 100% (5자 일치) | 동일 + v0.3-A 회귀 안전성 추가 | 안전성 강화 |

### 12-2. 신규 노출 (코드 영향)

- `tax_rules.js`: 신규 멤버 2종 (`HEAVY_TAX_RATE_ADDITION`·`findHeavyTaxRateAddition`) — `RULE_VERSION` 갱신
- `tax_engine.js`: 신규 함수 1종 권장 (`isHeavyTaxationApplicable`) + 단계 4·9 본문 변경
- `result.steps`: 신규 필드 4종 (`isHeavyTaxation`·`heavyRateAddition`·`shortTermTax`·`heavyProgressiveTax`)
- issueFlag: 신규 5종 + 보조 3종 + 폐기 1종 (`OUT_OF_V01_SCOPE_REGULATED_AREA`)

### 12-3. 인계 4건 처리 결과

| 인계 | 처리 결과 |
|---|---|
| **인계 1** (B-032 결과 객체 구조) | **v0.3-A 범위 외**. 5/6 PRD 또는 v0.3-B 진입 시점에 별도 처리. 본 명세서는 v0.2.1 명세 패턴 그대로 따름. |
| **인계 2** (정본 명칭 채택) | **정본 명칭 사용** (`NON_TAXABLE_HOLDING_MIN_YEARS`·`NON_TAXABLE_RESIDENCE_MIN_YEARS`). 별칭(`EXEMPTION_*_THRESHOLD_*`) 사용 금지. |
| **인계 3** (B-033 자동 조정대상지역 판정) | **post-MVP 인계**. v0.3-A는 사용자 직접 입력 가정 (`SALE_REGULATED_USER_INPUT` info로 책임 명시). |
| **인계 4** (B-024 일시적 2주택) | **옵션 (나) 미포함 채택**. v0.3-B 또는 post-MVP. 본 명세서 §1-4 결정 근거 명시. |

---

## 13. 모듈 스펙·작업지시서 갱신 영역 (작업 창 #11+ 인계)

본 명세서 v0.3-A 검증 통과 후, 다음 산출물이 후속 작업 창에서 작성된다.

### 13-1. 모듈 스펙 갱신 영역 (작업 창 #11 예정)

| 파일 | 갱신 영역 |
|---|---|
| `docs/v0.3/modules/tax_rules.md` v0.3-A | 신규 노출 멤버 26종 (v0.2.0 24종 + v0.3-A 신규 2종). `HEAVY_TAX_RATE_ADDITION` 룩업 정본. `findHeavyTaxRateAddition` 함수 계약. selfTest 보강 (`verifyHeavyTaxLookups`). |
| `docs/v0.3/modules/tax_engine.md` v0.3-A | 단계 4·9 변경. `isHeavyTaxationApplicable` 함수 계약. 결과 객체 신규 필드 4종. issueFlag 25종 카탈로그. 부트스트랩 가드 v0.3-A 추가. **(인계 1) 톱레벨 명세 vs 코드 불일치는 v0.3-A 범위 외 — v0.2.1 그대로**. |

### 13-2. 작업지시서 갱신 영역 (작업 창 #12+ 예정)

| 파일 | 갱신 영역 |
|---|---|
| `docs/05_code_work_orders/05_tax_rules_v0_3_a.md` | tax_rules.js v0.3-A 패치 작업지시서 (v0.2.0 → v0.3-A) |
| `docs/05_code_work_orders/06_tax_engine_v0_3_a.md` | tax_engine.js v0.3-A 패치 작업지시서 (단계 4·9 변경 + 결과 객체 신규 필드 + issueFlag 카탈로그 25종) |

### 13-3. 골든셋 갱신 영역

| 파일 | 갱신 영역 |
|---|---|
| `docs/v0.3/06_test_cases.md` v0.3-A | TC-006~010 v0.2 회귀 보존 + TC-011~014 v0.3-A 신규. 검증팀 손계산 + 홈택스 모의계산 결과 수록 (검증 후). |

### 13-4. 입력 스키마 갱신 영역 (변경 미미)

| 파일 | 갱신 영역 |
|---|---|
| `docs/v0.3/03_input_schema.md` v0.3-A | `saleRegulated` 활성 명시 (§4-2-1). 자동 보정 룰 변경 없음. `contractDate` post-MVP 인계 표시. |

### 13-5. v0.3-B (시나리오 엔진) 영역 — 별도 작업 창

본 작업 창은 v0.3-A만 산출. v0.3-B (시나리오 엔진 — 의사결정 #10 D안 적용)는 별도 작업 창에서 산출:

- `docs/v0.3/01_calc_engine_spec_b.md` (시나리오 엔진 산식)
- `docs/v0.3/modules/scenario_engine.md` (모듈 스펙)
- `docs/05_code_work_orders/07_scenario_engine.md` (작업지시서)
- 시나리오 엔진 골든셋 (시나리오 종류별 1건 이상)

> v0.3-A 검증 통과는 v0.3-B 진입의 선행 조건. v0.3-A 회귀 안전성 보장 후 v0.3-B 작업 창 신설.

---

## 14. 변경 이력

| 버전 | 일자 | 변경 |
|---|---|---|
| v0.1.0 | 2026-04-26 | 초판 (단일 주택 일반과세) |
| v0.1.1 | 2026-04-29 | TC-001~005 검증 통과 (KPI 100%) |
| v0.2.0 | 2026-04-30 | 1세대1주택 비과세 + 고가주택 안분 + 장특공 표 1·2 |
| v0.2.1 | 2026-05-01 | TC-006~010 검증 통과 (KPI 100%) + 산식 표기 룩업 테이블 정본 (의사결정 #5 강화 §0-1) |
| **v0.3-A** | **2026-05-02** | **본 버전. 작업 창 #10 산출.** (1) 다주택 중과 판정 메커니즘 신설 (§3 — 4단계 조건 + 가산세율 룩업 + 장특공 배제 + 단기세율 비교). (2) 단계 4 변경 (중과 시 longTermDeduction = 0). (3) 단계 9 변경 (중과 시 누진세율 + 가산세율 재계산). (4) saleRegulated 활성 (입력 스키마 변경). (5) issueFlag 카탈로그 25종 (v0.2.1 18종 + v0.3-A 신규 5 + 보조 3 − OUT_OF_V01_SCOPE_REGULATED_AREA 폐기 1). (6) `tax_rules.js` 신규 노출 2종 (`HEAVY_TAX_RATE_ADDITION` + `findHeavyTaxRateAddition`). (7) 결과 객체 신규 필드 4종 (`isHeavyTaxation`·`heavyRateAddition`·`shortTermTax`·`heavyProgressiveTax`). (8) 골든셋 신규 4건 (TC-011·012·013·014). (9) 인계 4건 처리 (B-032 범위 외, 정본 명칭 채택, B-033 post-MVP, B-024 미포함). |
| v0.3-B | 미정 | 시나리오 엔진 (의사결정 #10 D안 적용). 별도 작업 창. |

---

## 15. 자체 검증 결과 (작업 창 #10 산출 보고용)

### 15-1. 백로그 ID 정합성 검증

| 백로그 | 본문 정독 | 처리 결과 |
|---|---|---|
| **B-024** (일시적 2주택 — 시행령 제155조 ①) | ✅ — 본 명세서 §1-4에서 본문 정독 후 인용. v0.3 잠재 영역 명시. | **옵션 (나) 미포함 채택**. 입력 스키마 확장 필요 + 의사결정 #11 정확성 > 속도 + 본질 가치(중과 발동 vs 미발동 비교)와 직교. |
| B-032 (결과 객체 구조 명세 vs 코드 불일치) | ✅ — 인계 1로 명시 처리 | v0.3-A 범위 외 (§5-4) |
| B-033 (자동 조정대상지역 판정) | ✅ — 인계 3으로 명시 처리 | post-MVP 인계 (§4-2-1, B-021 통합) |
| B-022 (정수 처리 절사 vs 반올림) | ✅ — 본문 정독 후 §7-3 인용 | v0.3-A 무영향 |
| B-023 (부칙·경과규정) | ✅ — 본문 정독 후 §6-3 (HEAVY_TAX_TRANSITION_NOT_HANDLED 보조 issueFlag) 인용 | post-MVP 인계 (입력 필드 부재) |

> "...로 추정" 표기 사용 없음. 모든 백로그 본문 정독 후 인용.

### 15-2. 모듈 스펙 인용 정합성

| 인용 위치 | 인용 대상 | 정합성 |
|---|---|---|
| §0-1 | 명세서 v0.2.1 §0-1 (법령 개정 대응 아키텍처 3원칙) | ✅ — v0.2.1 본문 그대로 인용 |
| §3-1 | 소득세법 제104조 ⑦ 본문 + 의사결정 #1 양도일 가정 | ✅ — 법령 본문·의사결정 본문 정독 |
| §3-2-1 | 의사결정 #5 강화 원칙 (2) 룩업 테이블 우선 | ✅ — 의사결정 #11 v11 본문 인용 |
| §3-3 | 소득세법 제95조 ② 단서 | ✅ — 법령 본문 정독 |
| §3-4-2 | 누진세율표 (`PROGRESSIVE_BRACKETS` v0.1) + 가산세율 합산 | ✅ — v0.1 모듈 스펙 본문 정독 후 가산세율 합산 산출 |
| §3-4-3 | 누적 baseTax_with_addition 산출 (산식 검증용 참고 표) | ✅ — 본 명세서 자체 산출 (검증팀 검증 대상) |
| §3-5 | 소득세법 제104조 ⑦ 본문 단서 (보유 < 2년 + 중과) | ✅ — 법령 본문 정독 |
| §6 | v0.2.1 명세서 §6 (issueFlag 카탈로그 18종) + v0.3-A 신규 7종 | ✅ — v0.2.1 본문 정독 후 v0.3-A 신규 추가 |
| §10-1 | v0.1 골든셋 정답값 (TC-001 98,241,000 등) + v0.2 골든셋 정답값 | ✅ — `docs/v0.2/06_test_cases.md` 본문 정독 |

### 15-3. v0.2 회귀 안전성 검증

| 항목 | 검증 결과 |
|---|---|
| TC-001~005 (v0.1 회귀) totalTax 보존 | ✅ — `saleRegulated` 미입력 → 자동 보정 `false` → 중과 미발동 (조건 2) → v0.1 결과 그대로 |
| TC-006~010 (v0.2 회귀) totalTax 보존 | ✅ — `saleRegulated=false` 명시 → 중과 미발동 → v0.2 결과 그대로 |
| TC-006·007·009 (1세대1주택 비과세) | ✅ — `is1Se1House=true` → 조건 4 미충족 → 중과 미발동 |
| TC-008 (다주택 + 비조정) | ✅ — `saleRegulated=false` → 조건 2 미충족 → 표 1 적용 그대로 |
| TC-010 (일시적 2주택) | ✅ — `saleRegulated=false` → 조건 2 미충족 → 표 1 적용 그대로 |

### 15-4. v0.3-A 신규 검증 항목

| 검증 영역 | 본 명세서 명세 |
|---|---|
| 다주택 중과 판정 4단계 조건 | ✅ §3-1 (다주택 + 조정대상 + 양도일 + 비과세 미적용 AND) |
| 단계 4 변경 (장특공 배제) | ✅ §3-3 |
| 단계 8 영향 (보유기간 분기는 동일하나 단기 < 2년 + 중과는 §3-5 추가 처리) | ✅ §3-5 |
| 단계 9 변경 (가산세율 적용) | ✅ §3-4 + §3-5 |
| 골든셋 신규 본문 (TC-011~014) | ✅ §10-2 (검증팀 손계산 + 홈택스 모의계산 가능 형태) |

### 15-5. 자체 발견 짚을 부분 (3건)

본 명세서 작성 중 발견한 짚을 부분 3건. 후속 작업 창(#11+) 진입 시 추가 확인 필요.

#### 짚을 부분 1: 중과 누진세율 산출 — 룩업 vs 산식 흐름 트레이드오프 (§0-1-2)

- **현상**: 의사결정 #5 강화 원칙 (2) "룩업 테이블 우선"은 등차수열 산식 금지를 명시하나, 중과 누진세율표는 법령에 별도 표가 없어 (a) 가산세율 룩업 + 동적 재계산 vs (b) 중과 누진세율표 별도 보유의 트레이드오프 발생.
- **본 명세서 처리**: 옵션 (가) 채택 (가산세율 1개 룩업 + tax_engine.js 동적 재계산). 근거 §0-1-2.
- **후속 확인 필요**: 작업 창 #11 (모듈 스펙 v0.3-A) 작성 시 (a) 가산세율 룩업의 단순성 vs (b) 동적 재계산의 산식 흐름 추가 영향 재평가. v0.5+ 단계에서 다른 중과 케이스(예: 비사업용 토지 중과 +10%p 등) 추가 시 본 결정 일관성 유지 여부 재검토.

#### 짚을 부분 2: 시행령 제167조의10·11 단서 (중과 배제 사유) v0.3-A 미처리

- **현상**: 시행령 제167조의10 ① 단서(소형주택·수도권 외·취학 등 사유로 인한 일시적 2주택 등 13종) 및 제167조의11 ① 단서(장기임대주택 등)는 다주택 중과 발동 후 배제 사유로 작용. v0.3-A는 본 단서 미처리.
- **본 명세서 처리**: issueFlag `HEAVY_TAX_EXCLUSION_NOT_HANDLED` (info)로 사용자 안내. "전문가 검토 필요" 표시.
- **후속 확인 필요**: 검증팀 검토 시 본 단서가 v0.3-A 데모 케이스에 영향 없는지 확인. 발표 데모 케이스(B-018, 5/5 결정)는 본 단서 회피 권고. v0.5+ 단계에서 본 단서 본격 처리 시 신규 입력 필드 + 룩업 테이블 추가 필요.

#### 짚을 부분 3: 시스템 프롬프트 "v0.1 13종" 표기 vs 모듈 스펙 "v0.1 17종" 표기 충돌 (작업지시서 04 인계)

- **현상**: 시스템 프롬프트는 `tax_rules.js` v0.1 노출 멤버를 "13종"으로 표기. 모듈 스펙 v0.1.1·v0.2.0 §2-2 + 작업지시서 03 §3-1 + 작업지시서 04 §3-4는 "17종"으로 표기. 두 표기 충돌.
- **본 명세서 처리**: 모듈 스펙·작업지시서 정본 따름 (**v0.1 17종 + v0.2 신규 7종 = 24종 + v0.3-A 신규 2종 = 26종**).
- **후속 확인 필요**: 시스템 프롬프트 정정 또는 통합 표기 책임은 본 관제탑 (작업 창 #10 외부). 백로그 등록 권고.

### 15-6. 차단 사항

본 명세서 작성 완료. 차단 사항 없음.

후속 작업 창(#11 모듈 스펙 v0.3-A, #12 작업지시서 v0.3-A) 진입 가능 상태. v0.3-B (시나리오 엔진)는 v0.3-A 검증 통과 후 별도 작업 창에서 진행.

---

(끝)
