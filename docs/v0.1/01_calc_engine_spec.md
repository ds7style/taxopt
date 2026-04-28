# TaxOpt 계산 엔진 명세서 v0.1.1

| 항목 | 내용 |
|---|---|
| 문서 ID | `docs/v0.1/01_calc_engine_spec.md` |
| 버전 | v0.1.1 |
| 상태 | ✅ **검증 완료** (2026-04-28) |
| 검증 방식 | 검증팀 손계산 + 국세청 홈택스 모의계산 3자 일치 |
| 검증 케이스 | TC-001 ~ TC-005 (전 케이스 통과) |
| 작성일 | 2026-04-26 |
| 검증 완료일 | 2026-04-28 |
| 적용 법령 | 소득세법 [법률 제21065호, 시행 2026-01-02] / 시행령 [대통령령 제36129호, 시행 2026-03-01] |
| 적용 전제 | 양도일 ≥ 2026-05-10 (중과 유예 종료 후), 비조정대상지역, 거주자, 단독명의, 매매취득, 등기자산 |
| 다음 버전 | v0.2 (조정대상지역·다주택 중과·1세대1주택 비과세·장기보유특별공제 추가 예정) |

---

## 0. 명세서 위치

본 명세서는 단일 주택 일반과세 계산기의 **확정 산식**을 정의합니다. 같은 입력에 대해 본 명세서대로 계산한 결과는 검증팀 손계산 및 국세청 홈택스 모의계산 결과와 일치합니다(TC-001~005 기준). 본 명세서는 v0.2·v0.3 명세서가 확장하는 토대가 됩니다.

관련 문서:
- 입력 스키마: `docs/v0.1/03_input_schema.md`
- 골든셋 테스트 케이스: `docs/v0.1/06_test_cases.md`
- 의사결정 로그: `docs/99_decision_log.md`

---

## 1. 적용 범위

### 1-1. v0.1 포함

- 거주자의 국내 주택 양도 단일 건
- 사용자가 직접 입력한 양도가액·취득가액·필요경비 기준 계산
- 양도차익 → 양도소득금액 → 과세표준 → 산출세액 → 지방소득세 → 총 납부세액 → 세후 매각금액
- 양도소득 기본공제 연 250만원 (소득세법 제103조)
- 기본세율표 8단계 누진 (소득세법 제55조 제1항)
- 보유기간 1년 미만 70%, 1~2년 미만 60% 단기세율 분기 (제104조 제1항 제2호·제3호)
- 양도차손 발생 시 과세표준 0원 처리

### 1-2. v0.1 제외 (issueFlag로 표시)

다음 항목은 v0.1에서 구현하지 않으며, 발동 조건 충족 시 issueFlag로 경고만 표시합니다:

- 1세대1주택 비과세 (제89조)
- 고가주택 12억 초과분 과세 (제95조 제3항)
- 장기보유특별공제 (제95조 제2항)
- 다주택 중과 (제104조 제7항)
- 중과 유예 경과조치, 강남3구 잔금 유예
- 상속·증여·부담부증여
- 조합원입주권·분양권
- 미등기양도자산
- 부부공동명의
- 시나리오 생성·상태전이

### 1-3. 적용 전제

| 전제 | 내용 |
|---|---|
| 양도일 | ≥ 2026-05-10 (중과 유예 종료 후) |
| 소재지 | 비조정대상지역 (취득 당시·양도 당시 모두) |
| 거주성 | 거주자 |
| 명의 | 단독명의 |
| 취득 원인 | 매매취득 |
| 등기 여부 | 등기자산 |

---

## 2. 계산 파이프라인 (13단계)

| 단계 | 변수 | 계산식 | 근거 |
|---|---|---|---|
| 0 | — | `validateCaseData(caseData)` | — |
| 1 | `transferGain` | `salePrice − acquisitionPrice − necessaryExpense` | 제95조 ①, 제96조, 제97조 |
| 2 | (비과세 판정) | v0.1 미적용. `taxableGain = transferGain` | 제89조 (v0.2) |
| 3 | (고가주택 안분) | v0.1 미적용. `taxableGain` 그대로 | 제95조 ③ (v0.2) |
| 4 | `longTermDeduction` | `0` (v0.1 무조건 0) | 제95조 ② (v0.2) |
| 5 | `capitalGainIncome` | `taxableGain − longTermDeduction` (= `transferGain`) | 제95조 ① |
| 6 | `basicDeduction` | `basicDeductionUsed ? 0 : 2,500,000` | 제103조 |
| 7 | `taxBase` | `Math.max(0, capitalGainIncome − basicDeduction)` | 제92조 ③ |
| 8 | `holdingPeriodBranch` | 동월동일 비교로 보유기간 판정 → `"under1y"` / `"under2y"` / `"over2y"` | 제95조 ④ |
| 9 | `appliedRate` | 8단계 분기에 따라 적용 세율·구간 결정 | 제104조 ①, 제55조 ① |
| 10 | `calculatedTax` | 9단계 세율을 7단계 과세표준에 적용 (`Math.floor`) | 제55조 ①, 제104조 ① |
| 11 | `localIncomeTax` | `Math.floor(calculatedTax × 0.1)` | 지방세법 제103조의3 |
| 12 | `totalTax` | `calculatedTax + localIncomeTax` | — |
| 13 | `netAfterTaxSaleAmount` | `salePrice − totalTax` | v0.1 정의 (주석 참고) |

> **세후 매각금액 정의 주석**: v0.1은 취득가액·필요경비를 회수금에서 차감하지 않습니다. 사용자 직관(세후 순이익)과 다를 수 있으므로 화면 툴팁에 "취득가액·필요경비는 사전 지출이므로 회수 자금에서 차감하지 않음"을 명시합니다. v0.2에서 `transferExpense` 분리 입력 시 재정의 검토.

---

## 3. 보유기간 판정 (8단계 상세)

### 3-1. 분기 규칙

```
oneYearMark  = acquisitionDate + 1년 (동월동일)
twoYearMark  = acquisitionDate + 2년 (동월동일)

if (saleDate <  oneYearMark) → "under1y"   // 1년 미만 → 단기세율 70%
if (saleDate <  twoYearMark) → "under2y"   // 1~2년 미만 → 단기세율 60%
else                          → "over2y"    // 2년 이상 → 기본세율표
```

### 3-2. 경계 처리

- 동월동일 비교 시 `saleDate === oneYearMark`이면 "1년 이상"으로 본다 (즉 `under1y`가 아니다).
- 동월동일 비교 시 `saleDate === twoYearMark`이면 "2년 이상"으로 본다 (즉 `under2y`가 아니다).
- 양도일 ±3일 이내 경계 케이스에서 `HOLDING_PERIOD_BOUNDARY` issueFlag 발동 (전문가 검토 권고).

> **검증 결과**: TC-001(보유 6년 7개월 → over2y), TC-002(보유 1년 7개월 → under2y), TC-003(보유 약 6년 4개월 → over2y), TC-004(보유 6년 7개월 → over2y), TC-005(보유 약 8년 4개월 → over2y) 모두 검증 통과.

---

## 4. 세율 적용 (9단계·10단계 상세)

### 4-1. 단기세율 (소득세법 제104조 제1항 제2호·제3호)

| 분기 | 세율 | 산식 |
|---|---|---|
| `under1y` | 70% | `Math.floor(taxBase × 0.7)` |
| `under2y` | 60% | `Math.floor(taxBase × 0.6)` |

### 4-2. 기본세율표 (소득세법 제55조 제1항, 2026 시행)

| # | 과세표준 구간 | 산식 |
|---|---|---|
| 1 | ≤ 14,000,000 | `taxBase × 6%` |
| 2 | 14,000,000 < taxBase ≤ 50,000,000 | `840,000 + (taxBase − 14,000,000) × 15%` |
| 3 | 50,000,000 < taxBase ≤ 88,000,000 | `6,240,000 + (taxBase − 50,000,000) × 24%` |
| 4 | 88,000,000 < taxBase ≤ 150,000,000 | `15,360,000 + (taxBase − 88,000,000) × 35%` |
| 5 | 150,000,000 < taxBase ≤ 300,000,000 | `37,060,000 + (taxBase − 150,000,000) × 38%` |
| 6 | 300,000,000 < taxBase ≤ 500,000,000 | `94,060,000 + (taxBase − 300,000,000) × 40%` |
| 7 | 500,000,000 < taxBase ≤ 1,000,000,000 | `174,060,000 + (taxBase − 500,000,000) × 42%` |
| 8 | taxBase > 1,000,000,000 | `384,060,000 + (taxBase − 1,000,000,000) × 45%` |

### 4-3. 누진 연속성 자체검증 (8개 구간)

| 구간 상한 | 구간 산식 결과 | 다음 구간 시작 | 일치 |
|---|---|---|---|
| 14,000,000 | 840,000 | 840,000 | ✅ |
| 50,000,000 | 6,240,000 | 6,240,000 | ✅ |
| 88,000,000 | 15,360,000 | 15,360,000 | ✅ |
| 150,000,000 | 37,060,000 | 37,060,000 | ✅ |
| 300,000,000 | 94,060,000 | 94,060,000 | ✅ |
| 500,000,000 | 174,060,000 | 174,060,000 | ✅ |
| 1,000,000,000 | 384,060,000 | 384,060,000 | ✅ |

### 4-4. 비교산출세액 규정 (제104조 제1항 후단)

> *"하나의 자산이 다음 각 호에 따른 세율 중 둘 이상에 해당할 때에는 … 산출세액 중 큰 것"*

v0.1 단일 주택 일반과세에서는 `under1y`·`under2y`·`over2y` 중 한 가지만 적용되므로 비교 발생하지 않음. v0.3에서 다주택 중과 + 단기 동시 적용 케이스에서 다시 다룬다.

---

## 5. 절사 정책

| 단계 | 정책 |
|---|---|
| 입력값 | 원 단위 정수 (소수점 없음) |
| `transferGain` ~ `taxBase` | 정수 산술 결과를 그대로 사용 (별도 절사 없음) |
| `calculatedTax` | `Math.floor` (원 미만 절사) |
| `localIncomeTax` | `Math.floor` (원 미만 절사) |
| `totalTax`, `netAfterTaxSaleAmount` | 정수 합·차이므로 별도 절사 없음 |

> **참고**: 실제 신고서식의 10원 단위 절사 관행은 v0.2 검토 대상으로 둠. v0.1은 1원 단위 절사로 통일.

---

## 6. 출력 스키마 (taxResult v0.1)

```js
taxResult = {
  caseId:       "string",
  ruleVersion:  "v0.1.1-post-20260510",
  inputsEcho:   { /* 정규화된 입력값 echo */ },
  steps: {
    transferGain:           number,
    taxableGain:            number,   // v0.1: transferGain과 동일
    longTermDeduction:      number,   // v0.1: 항상 0
    capitalGainIncome:      number,
    basicDeduction:         number,   // 0 또는 2,500,000
    taxBase:                number,
    holdingPeriodBranch:    "under1y" | "under2y" | "over2y",
    appliedRate: {
      type:     "short70" | "short60" | "basic",
      bracket:  number,    // basic일 때 1~8 구간 번호
      label:    string     // 사람이 읽는 라벨, 예: "기본세율 1.5억 초과~3억 이하 (38% 누진)"
    },
    calculatedTax:          number,
    localIncomeTax:         number,
    totalTax:               number,
    netAfterTaxSaleAmount:  number
  },
  issueFlags: [
    { code: "string", severity: "info" | "warning" | "error", message: "string", lawRef: "string" }
  ],
  warnings:  ["string"],
  lawRefs:   ["소득세법 제95조", "소득세법 제97조", "소득세법 제103조", "소득세법 제104조", "소득세법 제55조"]
}
```

---

## 7. issueFlag 카탈로그 (v0.1)

| code | 발동 조건 | severity | 의미 |
|---|---|---|---|
| `LONG_TERM_DEDUCTION_NOT_APPLIED` | 보유기간 ≥ 3년 | info | v0.1은 장특공 미적용. v0.2에서 적용 예정 |
| `POSSIBLE_NON_TAXATION_1H1H` | 보유 ≥ 2년 + 거주 ≥ 2년 + 가구 내 다른 주택 입력 없음 | info | 1세대1주택 비과세 검토 필요 |
| `HIGH_VALUE_HOUSE` | salePrice ≥ 1,200,000,000 | info | 고가주택 12억 초과분 과세 검토 필요 |
| `OUT_OF_V01_SCOPE_REGULATED_AREA` | `acquisitionRegulated === true` OR `saleRegulated === true` | warning | v0.1 범위 외 (조정대상지역). v0.2 중과 적용 후 정확한 세액 산출 예정 |
| `NECESSARY_EXPENSE_BREAKDOWN_MISSING` | 항상 (단일 필드 입력) | info | 자본적지출·양도비 분리 미입력. v0.2 분리 예정 |
| `UNREGISTERED_ASSET_ASSUMED_FALSE` | 항상 | info | 등기자산 가정. 미등기 시 기본공제 배제·70% 세율 |
| `ACQUISITION_CAUSE_ASSUMED_PURCHASE` | 항상 | info | 매매취득 가정. 상속·증여 시 취득가액·취득일 산정 별도 |
| `HOLDING_PERIOD_BOUNDARY` | 양도일이 1년/2년 동월동일 ±3일 이내 | warning | 보유기간 경계 케이스. 전문가 검토 권고 |
| `TRANSFER_LOSS_DETECTED` | `transferGain < 0` | info | 양도차손 발생. 과세표준 0원으로 처리 |

---

## 8. 입력 검증 규칙 (validateCaseData)

| 항목 | 규칙 | 실패 시 |
|---|---|---|
| `salePrice` | 정수 ≥ 1 | 에러 (계산 불가) |
| `acquisitionPrice` | 정수 ≥ 1 | 에러 |
| `necessaryExpense` | 정수 ≥ 0 | 에러 (음수 불가) |
| `acquisitionDate < saleDate` | 부등식 | 에러 |
| `saleDate.year` | `baseYear`와 일치 권고 | warning |
| `saleDate ≥ "2026-05-10"` | v0.1 가정 | warning (이전이면 적용 범위 외) |
| `transferGain < 0` | 양도차손 | warning + `TRANSFER_LOSS_DETECTED` issueFlag + `taxBase=0` 처리 |
| `acquisitionRegulated === true` 또는 `saleRegulated === true` | 비조정 가정 | warning + `OUT_OF_V01_SCOPE_REGULATED_AREA` issueFlag (계산은 일반과세로 진행) |

---

## 9. 검증 결과 요약

본 명세서는 다음 절차로 검증되었습니다.

1. **자체 검증** (Claude): 누진 연속성 8개 구간 자체검증 통과
2. **검증팀 손계산** (설하영·이준기·김태환·김두섭): TC-001~005 5건 손계산
3. **국세청 홈택스 모의계산** 대조: 5건 모두 일치

자세한 검증 케이스와 결과는 `docs/v0.1/06_test_cases.md` 참고.

### 9-1. 검증 후 보류 항목

다음 2건은 v0.1 단일 주택 범위에서 발동되지 않으므로 v0.1에서 결정 보류:

- **단기세율 + 기본세율 비교산출세액 규정** (제104조 ① 후단) → v0.3 다주택 중과 + 단기 동시 케이스에서 결정
- **세후 매각금액 정의** (`salePrice − totalTax`) → v0.2 `transferExpense` 분리 입력 시 재정의 검토

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1.0 | 2026-04-26 | 초기 명세서 (자체 검증 전) |
| v0.1.1 | 2026-04-28 | P1~P10 패치 적용. 검증팀 + 홈택스 3자 일치로 확정. |

### 패치 상세 (v0.1.0 → v0.1.1)

| # | 패치 | 위치 |
|---|---|---|
| P1 | 보유기간 365.25 근사 → 동월동일 비교 | §3 |
| P2 | 절사 정책 명시 (`Math.floor` 통일) | §5 |
| P3 | 입력 검증 규칙 명시 | §8 |
| P4 | 세후 매각금액 정의 + 화면 툴팁 보강 예약 | §2 주석 |
| P5 | 비교산출세액 규정 v0.1 미적용 명시 | §4-4 |
| P6 | issueFlag 추가 (`HOLDING_PERIOD_BOUNDARY`, `TRANSFER_LOSS_DETECTED`) | §7 |
| P7 | 골든셋 5건 작성 → `06_test_cases.md`로 분리 | — |
| P8 | 비조정대상지역 가정 명시 | §1-3 |
| P9 | `OUT_OF_V01_SCOPE_REGULATED_AREA` issueFlag 추가 | §7, §8 |
| P10 | 13단계 파이프라인 (8단계와 9단계 사이에 적용 세율 단계 신설) | §2 |
