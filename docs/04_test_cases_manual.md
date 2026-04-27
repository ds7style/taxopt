# TaxOpt 수기 정답 — 검증용 테스트 케이스

**버전**: v0.1 시작  
**최종 갱신**: 2026-04-26  
**관리 원칙**: 케이스 1건당 1개 섹션. 케이스 ID 부여, 변수명·단위·법령 인용 형식 통일.

## 작성 규칙

1. **변수명**: 한글 라벨 옆에 영문 변수명 병기. 영문은 코드 변수명과 일치해야 함. (목록은 아래 표 참조)
2. **단위**: 모든 금액은 **원 단위 정수**. 1억 → 100,000,000. 콤마 표기는 가독성용으로 허용.
3. **날짜**: ISO 형식 `YYYY-MM-DD`. 예: 2026-08-31.
4. **개월·연**: 정수. 예: 보유기간 3년 5개월 → "보유기간 41개월".
5. **법령 인용**: `소득세법 제○○조 제○항 제○호` 형식. 시행령은 `소득세법 시행령 제○○조`.
6. **세율 적용**: 8단계 세율표 중 어느 구간에 들어갔는지 명시. 적용 산식까지 풀어 쓰기.
7. **허용 오차**: 1원 단위 정확 일치를 목표. 5원 이내 차이는 반올림 차이로 간주(허용).

## 표준 변수명 표

| 한글 | 영문 변수명 (코드와 일치) | 단위 |
|---|---|---|
| 양도가액 | salePrice | 원 |
| 취득가액 | acquisitionPrice | 원 |
| 필요경비 | necessaryExpense | 원 |
| 양도차익 | transferGain | 원 |
| 과세대상 양도차익 (고가주택 안분 후) | taxableGain | 원 |
| 장기보유특별공제액 | longTermDeduction | 원 |
| 양도소득금액 | capitalGainIncome | 원 |
| 양도소득 기본공제 | basicDeduction | 원 |
| 과세표준 | taxBase | 원 |
| 산출세액 | calculatedTax | 원 |
| 지방소득세 | localIncomeTax | 원 |
| 총 납부세액 | totalTax | 원 |
| 세후 매각금액 | netAfterTaxSaleAmount | 원 |
| 보유기간 | holdingPeriodMonths | 개월 |
| 거주기간 | residencePeriodMonths | 개월 |

---

## 케이스 TC-001: v0.1 검증용 단일 주택 일반과세

**버전 적용**: v0.1  
**작성자**: (작성자 기재)  
**작성일**: (작성일 기재)  
**검토자**: (검토자 기재)  
**상태**: 작성 중 / 검토 중 / 확정

### 1. 입력값 (Given)

| 항목 | 값 | 단위 | 비고 |
|---|---|---|---|
| 주택 종류 | 일반 주택 | — | 1세대1주택 비과세 미적용 가정 |
| 소재지 조정대상지역 여부 | 비조정대상 | — | 중과 미적용 |
| 취득일 | 2018-03-15 | YYYY-MM-DD | |
| 취득가액 (acquisitionPrice) | 600,000,000 | 원 | |
| 필요경비 (necessaryExpense) | 12,000,000 | 원 | 취득세·중개료 포함 |
| 양도일 | 2026-08-31 | YYYY-MM-DD | 중과 유예 종료 후 |
| 양도가액 (salePrice) | 1,200,000,000 | 원 | |
| 보유기간 (holdingPeriodMonths) | 101 | 개월 | 약 8년 5개월 |
| 거주기간 (residencePeriodMonths) | 36 | 개월 | |
| 거주자 여부 | 거주자 | — | |

### 2. 적용 법령 (Reference)

- 소득세법 제55조 제1항: 기본세율표 (양도소득세에도 적용)
- 소득세법 제95조: 양도소득금액의 계산 (양도차익 - 장기보유특별공제)
- 소득세법 제95조 제2항 표1: 장기보유특별공제 보유기간별 공제율
- 소득세법 제103조: 양도소득 기본공제 250만원
- 소득세법 제104조 제1항 제1호: 양도소득세율 (제55조 제1항 준용)
- 지방세법 제103조의3: 지방소득세율 10%

### 3. 계산 단계 (Step-by-step)

#### 3.1 양도차익 (transferGain)

transferGain = salePrice - acquisitionPrice - necessaryExpense
= 1,200,000,000 - 600,000,000 - 12,000,000
= (계산)

#### 3.2 장기보유특별공제 (longTermDeduction)
- 보유기간: 101개월 = 8년 5개월
- 적용 표: 표1 (다주택 중과 미적용 일반)
- 적용 구간: 8년 이상 9년 미만 → 공제율 16%
- 산식: longTermDeduction = transferGain × 0.16
= (계산)

#### 3.3 양도소득금액 (capitalGainIncome)

capitalGainIncome = transferGain - longTermDeduction
= (계산)

#### 3.4 양도소득 기본공제 (basicDeduction)

- 연 250만원 (해당 과세기간에 다른 양도가 없다고 가정)
basicDeduction = 2,500,000

#### 3.5 과세표준 (taxBase)

taxBase = capitalGainIncome - basicDeduction
= (계산)

#### 3.6 산출세액 (calculatedTax)
- 적용 세율표 구간: (해당 구간 명시. 예: 1억5천만원 초과 ~ 3억원 이하)
- 산식: calculatedTax = (taxBase 적용 구간 base) + (taxBase - 구간 하한) × 구간 rate
= (계산)

#### 3.7 지방소득세 (localIncomeTax)

localIncomeTax = calculatedTax × 0.10
= (계산)

#### 3.8 총 납부세액 (totalTax)

totalTax = calculatedTax + localIncomeTax
= (계산)

#### 3.9 세후 매각금액 (netAfterTaxSaleAmount)

netAfterTaxSaleAmount = salePrice - acquisitionPrice - necessaryExpense - totalTax
= (계산)

또는 양도차익 기반: netAfterTaxSaleAmount = salePrice - totalTax

(어느 정의를 쓸지는 명세서 v0.1과 일치시킬 것. 본 양식은 후자 사용 가정)

### 4. 결과값 (Result)

| 변수 | 값 (원) |
|---|---|
| transferGain | (값) |
| longTermDeduction | (값) |
| capitalGainIncome | (값) |
| basicDeduction | 2,500,000 |
| taxBase | (값) |
| calculatedTax | (값) |
| localIncomeTax | (값) |
| **totalTax** | **(값)** |
| **netAfterTaxSaleAmount** | **(값)** |

### 5. 가정·주의사항 (Assumptions / Caveats)

- 1세대1주택 비과세 적용하지 않음 (v0.1은 일반과세만 다룸)
- 다주택 중과 적용 안 됨 (비조정대상지역 가정)
- 미등기 양도 아님
- 감면세액 없음
- 기본공제 잔여 250만원 모두 사용 가정 (해당 과세기간 다른 양도 없음)
- 공동소유 아님 (단독명의)

### 6. issueFlag 후보

(법령 해석상 불명확하거나 추가 검토가 필요한 항목 — 없으면 "없음")

---

## 케이스 TC-002: v0.3 검증용 2주택 시나리오 비교

**버전 적용**: v0.3  
**작성자**: (작성자 기재)  
**작성일**: (작성일 기재)  
**상태**: 작성 중

(TC-001과 같은 형식으로 작성. 시나리오 (가) A 먼저, (나) B 먼저 두 가지를 각각 풀어 쓸 것. 각 시나리오 안에서 첫 번째 양도와 두 번째 양도를 분리하여 계산.)

### 시나리오 (가): A 먼저 양도 → B 나중 양도

#### 양도 1차: 주택 A
- (TC-001 형식의 9단계 계산. 단, 다주택 중과 적용)
- 적용 법령 추가: 소득세법 제104조 (다주택 중과세율 +20%p)
- 적용 법령 추가: 소득세법 제95조 제2항 (중과 시 장특공 배제)

#### 양도 2차: 주택 B
- (1세대1주택 비과세 적용 가능 여부 검토)
- 12억 초과분만 과세 (해당 시)
- (TC-001 형식의 9단계 계산)

#### 시나리오 (가) 합계
- 합계 totalTax: (값)
- 합계 netAfterTaxSaleAmount: (값)

### 시나리오 (나): B 먼저 양도 → A 나중 양도

(동일 형식)

### 시나리오 비교

| 항목 | (가) A 먼저 | (나) B 먼저 |
|---|---|---|
| 합계 totalTax | (값) | (값) |
| 합계 netAfterTaxSaleAmount | (값) | (값) |

### 결론
(어느 시나리오가 유리한지, 차액)

---

## 결과 적용 메모

수기 정답지 작성 후 적용 흐름:
1. 본 파일을 GitHub repo의 `docs/04_test_cases_manual.md`로 커밋
2. 동일 케이스를 코드용 JSON으로 변환하여 `tests/test_cases.js`에 등록 (v0.1 코드 구현 시점)
3. 코드 결과 vs 수기 정답을 비교하여 PRD KPI "정답 일치율 90% 이상" 측정