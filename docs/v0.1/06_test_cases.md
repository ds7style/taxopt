# TaxOpt 테스트 케이스 v0.1.1 (골든셋)

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.1/06_test_cases.md` |
| 버전 | v0.1.1 |
| 상태 | ✅ **검증 완료** (2026-04-28) |
| 검증 방식 | 검증팀 손계산 + 국세청 홈택스 모의계산 3자 일치 |
| 작성일 | 2026-04-26 |
| 검증 완료일 | 2026-04-28 |
| 검증자 | 설하영, 이준기, 김태환, 김두섭 (구글시트 작성) |
| 검증 도구 | 손계산 + 국세청 홈택스 양도소득세 모의계산기 |
| 관련 문서 | `01_calc_engine_spec.md`, `03_input_schema.md` |
| 코드 변환 | `tests/test_cases.js` (작업 창 #2 산출물 예정) |

---

## 0. 골든셋의 의미

본 5개 테스트 케이스는 다음 3자가 모두 일치한 결과로 확정된 **골든셋**입니다:

1. Claude의 명세서(`01_calc_engine_spec.md`) 산식 적용 결과
2. 검증팀(설하영·이준기·김태환·김두섭) 독립 손계산 결과
3. 국세청 홈택스 양도소득세 모의계산기 결과

골든셋은 v0.1 코드의 정답 검증용이며, v0.2·v0.3로 산식이 확장되더라도 **단일 주택 일반과세 시나리오에서는 동일 결과를 유지해야 하는 회귀 검증 기준**입니다.

> **검증 분리 원칙**: 본 문서의 정답값이 사용자(개발자)에게 노출되더라도 v0.2·v0.3 검증 시 새 케이스는 다시 검증팀이 독립적으로 손계산해야 합니다. 골든셋 자체는 검증팀의 결과로 채워진 값이며, Claude나 코드의 산출물이 아닙니다.

---

## 1. 케이스 일람

| ID | 검증 의도 | 보유기간 분기 | 적용 세율 |
|---|---|---|---|
| TC-001 | 정상 일반과세, 누진 5구간 (1.5억~3억) | over2y | 기본세율 38% 누진 |
| TC-002 | 단기세율 60% 단독 적용 | under2y | 단기 60% |
| TC-003 | 양도차손 발생 시 0원 처리 | over2y | 적용 없음 (taxBase=0) |
| TC-004 | 기본공제 사용 시 0원 적용 | over2y | 기본세율 38% 누진 |
| TC-005 | 누진 1구간 경계값 (taxBase=14,000,000) | over2y | 기본세율 1구간 6% |

---

## 2. TC-001 — 정상 일반과세 (보유 6년 7개월)

### 2-1. 입력

| 항목 | 값 |
|---|---|
| acquisitionDate | 2020-01-15 |
| acquisitionPrice | 500,000,000 |
| necessaryExpense | 10,000,000 |
| saleDate | 2026-08-31 |
| salePrice | 800,000,000 |
| basicDeductionUsed | false |
| acquisitionRegulated | false |
| saleRegulated | false |

### 2-2. 단계별 정답값

| 단계 | 변수 | 값 |
|---|---|---|
| 1 | transferGain | 290,000,000 |
| 2 | (비과세 후) | 290,000,000 |
| 3 | (고가주택 후) | 290,000,000 |
| 4 | longTermDeduction | 0 |
| 5 | capitalGainIncome | 290,000,000 |
| 6 | basicDeduction | 2,500,000 |
| 7 | taxBase | 287,500,000 |
| 8 | holdingPeriodBranch | "over2y" |
| 9 | appliedRate | 기본세율 1.5억 초과~3억 이하 (38% 누진) |
| 10 | calculatedTax | 89,310,000 |
| 11 | localIncomeTax | 8,931,000 |
| 12 | totalTax | 98,241,000 |
| 13 | netAfterTaxSaleAmount | 701,759,000 |

### 2-3. 산식 검산

```
transferGain   = 800,000,000 − 500,000,000 − 10,000,000 = 290,000,000
taxBase        = 290,000,000 − 2,500,000                = 287,500,000
calculatedTax  = 37,060,000 + (287,500,000 − 150,000,000) × 0.38
               = 37,060,000 + 52,250,000                = 89,310,000
localIncomeTax = floor(89,310,000 × 0.1)                = 8,931,000
totalTax       = 89,310,000 + 8,931,000                 = 98,241,000
```

### 2-4. issueFlag

| code | 발동 | 비고 |
|---|---|---|
| `LONG_TERM_DEDUCTION_NOT_APPLIED` | ✅ | 보유 6년 7개월 ≥ 3년 |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | ✅ | 항상 |
| `UNREGISTERED_ASSET_ASSUMED_FALSE` | ✅ | 항상 |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | ✅ | 항상 |

---

## 3. TC-002 — 단기세율 60% (보유 1년 7개월)

### 3-1. 입력

| 항목 | 값 |
|---|---|
| acquisitionDate | 2025-01-15 |
| acquisitionPrice | 600,000,000 |
| necessaryExpense | 5,000,000 |
| saleDate | 2026-08-31 |
| salePrice | 700,000,000 |
| basicDeductionUsed | false |

### 3-2. 단계별 정답값

| 단계 | 변수 | 값 |
|---|---|---|
| 1 | transferGain | 95,000,000 |
| 5 | capitalGainIncome | 95,000,000 |
| 6 | basicDeduction | 2,500,000 |
| 7 | taxBase | 92,500,000 |
| 8 | holdingPeriodBranch | "under2y" |
| 9 | appliedRate | 단기세율 60% |
| 10 | calculatedTax | 55,500,000 |
| 11 | localIncomeTax | 5,550,000 |
| 12 | totalTax | 61,050,000 |
| 13 | netAfterTaxSaleAmount | 638,950,000 |

### 3-3. 산식 검산

```
oneYearMark   = 2026-01-15
twoYearMark   = 2027-01-15
saleDate      = 2026-08-31  (oneYearMark < saleDate < twoYearMark) → "under2y"
calculatedTax = floor(92,500,000 × 0.6) = 55,500,000
```

---

## 4. TC-003 — 양도차손 (양도가액 < 취득가액)

### 4-1. 입력

| 항목 | 값 |
|---|---|
| acquisitionDate | 2020-06-01 |
| acquisitionPrice | 500,000,000 |
| necessaryExpense | 10,000,000 |
| saleDate | 2026-09-30 |
| salePrice | 480,000,000 |
| basicDeductionUsed | false |

### 4-2. 단계별 정답값

| 단계 | 변수 | 값 |
|---|---|---|
| 1 | transferGain | −30,000,000 |
| 5 | capitalGainIncome | −30,000,000 |
| 6 | basicDeduction | 2,500,000 |
| 7 | taxBase | 0 (max(0, ...) 처리) |
| 8 | holdingPeriodBranch | "over2y" |
| 9 | appliedRate | 적용 없음 (taxBase=0) |
| 10 | calculatedTax | 0 |
| 11 | localIncomeTax | 0 |
| 12 | totalTax | 0 |
| 13 | netAfterTaxSaleAmount | 480,000,000 |

### 4-3. issueFlag

| code | 발동 | 비고 |
|---|---|---|
| `TRANSFER_LOSS_DETECTED` | ✅ | transferGain < 0 |

---

## 5. TC-004 — 기본공제 이미 사용 (TC-001 변형)

### 5-1. 입력

TC-001과 동일하되 `basicDeductionUsed = true`.

### 5-2. 단계별 정답값

| 단계 | 변수 | 값 |
|---|---|---|
| 1 | transferGain | 290,000,000 |
| 6 | basicDeduction | **0** (TC-001과 차이) |
| 7 | taxBase | 290,000,000 |
| 9 | appliedRate | 기본세율 1.5억 초과~3억 이하 (38% 누진) |
| 10 | calculatedTax | 90,260,000 |
| 11 | localIncomeTax | 9,026,000 |
| 12 | totalTax | 99,286,000 |
| 13 | netAfterTaxSaleAmount | 700,714,000 |

### 5-3. TC-001 대비 차이 검증

| 항목 | TC-001 | TC-004 | 차이 |
|---|---|---|---|
| basicDeduction | 2,500,000 | 0 | -2,500,000 |
| taxBase | 287,500,000 | 290,000,000 | +2,500,000 |
| calculatedTax | 89,310,000 | 90,260,000 | +950,000 (= 2,500,000 × 0.38) |
| totalTax | 98,241,000 | 99,286,000 | +1,045,000 (= 950,000 × 1.1) |

기본공제 미사용 시 과세표준이 250만원 증가하고, 38% 구간에 있으므로 산출세액은 95만원 증가, 지방세 포함 총 104만 5천원 증가. 일치 확인.

---

## 6. TC-005 — 누진 1구간 경계값 (taxBase = 14,000,000)

### 6-1. 입력

| 항목 | 값 |
|---|---|
| acquisitionDate | 2018-03-01 |
| acquisitionPrice | 200,000,000 |
| necessaryExpense | 0 |
| saleDate | 2026-07-15 |
| salePrice | 216,500,000 |
| basicDeductionUsed | false |

### 6-2. 단계별 정답값

| 단계 | 변수 | 값 |
|---|---|---|
| 1 | transferGain | 16,500,000 |
| 6 | basicDeduction | 2,500,000 |
| 7 | taxBase | 14,000,000 |
| 8 | holdingPeriodBranch | "over2y" |
| 9 | appliedRate | 기본세율 1구간 6% |
| 10 | calculatedTax | 840,000 |
| 11 | localIncomeTax | 84,000 |
| 12 | totalTax | 924,000 |
| 13 | netAfterTaxSaleAmount | 215,576,000 |

### 6-3. 누진 연속성 검증

`taxBase = 14,000,000`은 1구간(≤ 14,000,000)의 상한이자 2구간(> 14,000,000) 시작점.

- 1구간 산식: `14,000,000 × 6% = 840,000`
- 2구간 산식: `840,000 + (14,000,000 − 14,000,000) × 15% = 840,000`

두 산식 결과 일치. 명세서 §4-3 누진 연속성 자체검증과 일치.

---

## 7. 검증 결과 종합

| TC | 검증팀 손계산 | Claude 명세서 산출 | 홈택스 모의계산 | 결과 |
|---|---|---|---|---|
| TC-001 | 98,241,000 | 98,241,000 | 98,241,000 | ✅ 일치 |
| TC-002 | 61,050,000 | 61,050,000 | 61,050,000 | ✅ 일치 |
| TC-003 | 0 | 0 | 0 | ✅ 일치 |
| TC-004 | 99,286,000 | 99,286,000 | 99,286,000 | ✅ 일치 |
| TC-005 | 924,000 | 924,000 | 924,000 | ✅ 일치 |

(totalTax 기준 비교)

---

## 8. 자동 테스트 변환 가이드

`tests/test_cases.js`에 다음 형태로 변환:

```js
const TC_GOLDEN_V01 = [
  {
    id: "TC-001",
    intent: "정상 일반과세 (보유 6년 7개월, 누진 5구간)",
    input: {
      acquisitionDate:    "2020-01-15",
      acquisitionPrice:   500_000_000,
      necessaryExpense:    10_000_000,
      saleDate:           "2026-08-31",
      salePrice:          800_000_000,
      basicDeductionUsed: false,
      acquisitionRegulated: false,
      saleRegulated:        false
    },
    expected: {
      transferGain:        290_000_000,
      capitalGainIncome:   290_000_000,
      basicDeduction:        2_500_000,
      taxBase:             287_500_000,
      holdingPeriodBranch: "over2y",
      calculatedTax:        89_310_000,
      localIncomeTax:        8_931_000,
      totalTax:             98_241_000,
      netAfterTaxSaleAmount: 701_759_000
    }
  },
  // TC-002 ~ TC-005 동일 패턴
];

// 실행
TC_GOLDEN_V01.forEach(tc => {
  const actual = calculateSingleTransfer(tc.input);
  Object.entries(tc.expected).forEach(([k, v]) => {
    console.assert(actual.steps[k] === v, `${tc.id}: ${k} expected ${v}, got ${actual.steps[k]}`);
  });
});
```

상세 구현은 작업 창 #2의 `tests/test_cases.js` 산출물에서 확정.

---

## 9. v0.2·v0.3 회귀 검증 원칙

v0.2·v0.3에서 산식이 확장되더라도 본 5개 케이스는 **그대로 통과해야 합니다.** 이유:

- 5개 모두 비조정대상지역, 단일 주택, 일반과세 케이스
- v0.2 추가 기능(비과세·고가주택·장특공)은 본 케이스에서 발동 조건을 만족하지 않음
  - 비과세: 보유·거주 요건이 비과세를 만족하지 않거나, 단일 주택 가정만 두고 1세대1주택 판정 보류
  - 고가주택: TC-001~005 모두 salePrice < 12억
  - 장특공: 단일 주택이 1세대1주택 비과세 케이스가 아니라면 v0.2 장특공도 변동 가능. 발동 시 별도 케이스(TC-006 이후)로 추가
- v0.3 추가 기능(중과)은 비조정대상지역이라 발동 안 함

따라서 v0.2·v0.3 코드가 본 5개 결과를 깨뜨리면 **회귀 버그**로 간주.

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.0 | 2026-04-26 | 초기 5개 케이스 작성 (Claude 명세서 산출값 기준) |
| v0.1.1 | 2026-04-28 | 검증팀 손계산 + 홈택스 3자 일치 확인. 골든셋으로 확정. |
