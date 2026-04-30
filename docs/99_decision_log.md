# TaxOpt 의사결정 로그

**최종 갱신**: 2026-04-30  
**관리 원칙**: 단일 파일 유지. 새 의사결정은 추가, 번복 시 Deprecated 섹션으로 이동, 파일명에 버전 숫자 붙이지 않음.

---

## 갱신 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-04-30 (v10) | #10 신규 — 시나리오 비교 1순위 정렬 지표 (D안 + 보강 4건). 백로그 B-008 처리 완료(closure). 백로그 B-009~B-018 신규 9건 등록. 입력 스키마 v0.1.2 패치 (House에 specialTaxFlags·specialTaxRequirementsMet 추가, v0.6+ 활성). 작업 창 #5(의사결정 #10 심층 검토 전용)의 검토 보고서 + v10 본문 초안 + 입력 스키마 패치 산출 |
| 2026-04-29 (v9) | #9 사후 인정 확정 — Claude Code 검증 + Node.js 회귀 테스트 67/0 통과로 tax_rules.js·tax_rules.test.js 정식 인정 |
| 2026-04-29 (v8) | #9 정정 — 작업 창 분담 원칙 명문화 (작업 창 #1-1의 .js 코드 최종 산출 금지, Claude Code 단일 책임). 작업 창 #1-1 자체 분석에 따른 정정 |
| 2026-04-29 (v7) | #5 보강(테스트 파일 *.test.js), #2 일정·산출물 진행 갱신, #9 신규(작업지시서 사후 운명 — v8에서 정정), v0.2 검증팀 옵션 A·후퇴 트리거 옵션 C·데모 케이스 5/5 이연 등 운영 결정 흡수 |
| 2026-04-28 (v6) | 작업 창 번호 체계 계층형 정정(#2→#1-1), 작업지시서 표기 통일(#1→01) |
| 2026-04-28 (v5) | #8 보강 — Code 작업지시서 위치 docs/05_code_work_orders/, "Codex"→"Code" 일괄 정정 |
| 2026-04-28 (v4) | #8 v0.1 명세서 검증 완료 + 버전별 폴더 구조 (docs/v{버전}/) |
| 2026-04-27 (v3) | #5 보강 — 모든 .js 파일은 언더바(snake_case) 명명 |
| 2026-04-27 (v2) | #7 GitHub Repo 명세 추가 |
| 2026-04-27 (v1) | 초기 작성. 의사결정 #1~#6 등록 |

---

## 현행 의사결정 (Active)

### #1. 중과 유예 처리

- **결정일**: 2026-04-27
- **결정**: 다주택 중과 유예가 종료된 상태(2026.5.10. 이후 양도)를 기본 전제로 삼는다.
- **근거**:
  - 소득세법 부칙
  - PRD 03절 "다주택자 양도소득세 중과 유예 조치가 2026년 5월 9일 예정대로 종료"
  - PRD 6-3절 대표 사례 "양도 시점: 2026.5.9. 이후"
- **세부 적용**:
  - 모든 시나리오의 양도 예정일은 2026.5.10. 이후로 가정
  - 조정대상지역 다주택자 양도 시 기본세율 + 20%p(2주택) / +30%p(3주택) 적용
  - 중과 대상 주택은 장기보유특별공제 적용 배제 (소득세법 제95조)
  - 중과 유예 경과규정, 강남3구 특례 등은 MVP에서 구현하지 않음 → issueFlag 처리
  - 양도일이 2026.5.9. 이전인 경우 입력 검증 단계에서 경고 + "전문가 검토 필요" 표시
- **영향 범위**: tax_rules.js, scenario 가정값, 입력 검증

### #2. 개발 범위와 마일스톤

- **결정일**: 2026-04-27 / 2026-04-28 (일정 갱신) / 2026-04-30 (v0.1 완료 반영)
- **결정**: A안 — 5/7 2차 발표까지 v0.1 → v0.2 → v0.3 단계적 진행.
- **이유**: PRD 5-1절 P0 핵심 메시지를 데모에서 살리기 위해서는 단일 주택 일반과세만으로 부족하며, 비과세·중과·시나리오 엔진까지 필요함.
- **버전별 범위 및 진행 상황 (2026-04-30 기준)**:

  | 버전 | 범위 | 목표일 | 상태 |
  |---|---|---|---|
  | v0.1 | 단일 주택 일반과세 계산 | 4/29(수) | ✅ 완료 (코드 + 라이브 검증) |
  | v0.2 | + 장특공 + 1세대1주택 비과세 | 5/2(토) | ⏳ 진행 중 (4/30 명세서 시작) |
  | v0.3 | + 다주택 중과 + 시나리오 엔진 + 상태전이 (의사결정 #10 적용) | 5/4(월) | ❌ 미착수 |
  | v0.4 | + 결과 화면 동적 렌더링 + 설명 문장 | 5/6(수) | ❌ 미착수 |
  | 발표 | 2차 발표 | 5/7(목) | — |

- **검증 운영 원칙**:
  - "검증팀 독립 손계산 + 외부 도구 교차검증" 패턴을 모든 버전에 적용
  - v0.1 검증: TC-001~005 5건 모두 3자 일치 (검증팀·Claude·홈택스) + Node.js 회귀 234/0 + GitHub Pages 라이브 검증 통과
  - v0.2 검증팀 가용: 4/30 오전부터 가용 (옵션 A 확정)
- **후퇴 시나리오**: 5/4 시점에 v0.3가 동작하지 않으면 즉시 v0.2로 후퇴.
- **후퇴 트리거 발동 시 권한**: 작업 창에서 트리거 발동 즉시 총괄창에 보고 → 총괄창에서 30분 내 결정 (옵션 C). 작업 창 단독 결정 금지.
- **발표 데모 케이스**: v0.3 완성 후 5/5에 결정.
- **영향 범위**: 전체 일정, 모듈 구현 순서

### #3. salePlan UI 통합 위치

- **결정일**: 2026-04-27
- **결정**: 기존 ②세대 기본 정보 카드와 ③주택별 정보 입력 카드 사이에 "②.5 양도 계획" 카드를 신설한다.
- **근거**: 사용자가 주택별 정보를 입력하기 전에 "몇 채 팔지"를 먼저 결정하는 흐름이 자연스럽고, salePlan의 fixedSaleHouseIds·excludedHouseIds가 주택 ID와 연결되므로 주택 입력 직전에 위치하는 것이 적합.
- **세부 사항**: 카드 markup 패턴(.card / .card-header / .card-body)과 기존 CSS 변수 그대로 사용. 기존 카드 ②, ③ 디자인 변경 금지.
- **진행 상황**: index.html 승격 + ②.5 카드 반영 + GitHub Pages 배포 완료 (4/28)
- **영향 범위**: index.html, input_collector.js

### #4. AI 자동 입력 기능

- **결정일**: 2026-04-27
- **결정**: 자연어 입력 → 폼 자동 채우기 기능을 5/7 데모 범위에서 제외한다.
- **이유**: PRD P0 핵심 가치에 포함되지 않으며, KPI에도 무관. 발표 시연 중 LLM이 엉뚱한 값을 뽑을 사고 위험. 계산 엔진 일정에 자원 집중 우선.
- **세부 처리**:
  - 기존 nlp-area 텍스트영역 숨김 또는 제거
  - btn-ai-extract 버튼 숨김 또는 제거
  - dummyExtract(), runAiExtract() 함수는 호출되지 않도록
  - highlightMissing(), field-error 빨간 테두리, missing-banner는 수동 입력 검증에도 유용하므로 유지
- **재검토 시점**: 5/7 이후 v0.5 단계
- **영향 범위**: index.html

### #5. 코드 파일 구조

- **결정일**: 2026-04-27 (v1) / 2026-04-27 (v3 보강 — snake_case) / 2026-04-29 (v7 보강 — 테스트 파일)
- **결정**: 계산·시나리오 관련 코드는 인라인 <script>가 아닌 별도 .js 파일로 분리. ES6 module은 사용하지 않고 비-모듈 <script src="..."> 다중 로드 방식.
- **이유**:
  - v0.3까지 가면 코드량이 600~800줄로 폭증해 단일 HTML로는 관리 한계
  - PRD 11절 KPI "규칙 테스트 통과율 95% 이상" 충족을 위해 함수가 import 가능해야 함
  - index.html과 result.html이 같은 함수를 공유하려면 별도 파일이 필수
  - ES6 module 대신 비-모듈 방식: 로컬 file:// 환경과 GitHub Pages 모두 추가 도구 없이 동작
- **파일명 명명 규칙**:
  - 코드 파일: snake_case → tax_rules.js, tax_engine.js, scenario_engine.js, input_collector.js, result_renderer.js, explanation_engine.js
  - 테스트 파일: *.test.js 접미어 → tax_rules.test.js, tax_engine.test.js, scenario_engine.test.js
  - 문서 파일: snake_case → 99_decision_log.md
- **영향 범위**: 모든 코드 파일 구조, Code 작업지시서

### #6. 산출물 영속화

- **결정일**: 2026-04-27 (v1) / 2026-04-28 (v4 보강 — 형식 다양화)
- **결정**: 모든 작업 창 산출물은 docs/ 디렉토리의 .md 파일로 사용자가 로컬에 저장하고, 안정화·검증 후 Claude.ai 프로젝트 지식에 업로드. 채팅 답변만 있는 상태를 산출물 완료로 간주하지 않음.
- **이유**:
  - 채팅 컨텍스트 한도 초과·세션 종료·실수 삭제 시 산출물 유실 위험
  - PRD 8-7절 "추적 가능성" 충족
  - 5/7 발표 자료 인용 시 파일 형태가 필요
- **영속화 형식 다양화**:
  - 문서·로그·매핑표·명세서: .md
  - 표 데이터: 구글 시트(작업) + GitHub .xlsx(영속화)
  - 발표 자료: .pptx 또는 .pdf
  - 차트·다이어그램: .png 또는 .svg
  - 코드: .js (적절한 디렉토리)
- **운영 원칙**:
  - 산출물 파일명: docs/{번호}_{작업명}.md
  - 의사결정 로그는 docs/99_decision_log.md 단일 파일 유지, 갱신 시 덮어쓰기
  - 백로그는 docs/98_backlog.md 단일 파일
  - Claude.ai 프로젝트 지식 업로드: 안정화·검증된 산출물만
- **영향 범위**: 모든 작업 창의 산출물 처리 방식

### #7. GitHub Repo 명세

- **결정일**: 2026-04-27
- **결정**: 새 GitHub repo taxopt를 신설하여 프로젝트 자산을 정리. 기존 caio-poc는 Archive 처리.
- **세부 명세**:

  | 항목 | 결정값 |
  |---|---|
  | repo 이름 | taxopt |
  | repo URL | https://github.com/ds7style/taxopt |
  | GitHub Pages URL | https://ds7style.github.io/taxopt/ |
  | 공개 여부 | Public |
  | 라이선스 | MIT |
  | 기본 브랜치 | main |
  | GitHub Pages | 활성화 (main / root) |
  | 기존 caio-poc | Archive 처리 완료 |

- **디렉토리 구조 (2026-04-30 v10 갱신 — v0.1 완료 반영)**:

taxopt/
├── README.md
├── .gitignore
├── LICENSE
├── index.html                            ← v0.5 ②.5 카드 + tax_rules.js + tax_engine.js 연결
├── js/
│   ├── tax_rules.js                      ← v0.1.1 사후 인정 확정 (#9)
│   └── tax_engine.js                     ← v0.1.1 신규 작성 (Claude Code, 234/0)
├── tests/
│   ├── tax_rules.test.js                 ← 회귀 테스트 67건
│   └── tax_engine.test.js                ← 회귀 테스트 234건
├── docs/
│   ├── v0.1/
│   │   ├── 01_calc_engine_spec.md       ← 명세서 v0.1.1
│   │   ├── 03_input_schema.md            ← 입력 스키마 v0.1.2 (#10 패치)
│   │   ├── 06_test_cases.md              ← TC-001~005 골든셋
│   │   └── modules/
│   │       ├── tax_rules.md              ← 모듈 스펙
│   │       └── tax_engine.md             ← 모듈 스펙
│   ├── 02_saleplan_ui_design.md
│   ├── 04_test_cases_manual.xlsx
│   ├── 05_code_work_orders/
│   │   ├── 01_tax_rules.md
│   │   └── 02_tax_engine.md
│   ├── 98_backlog.md                     ← B-001~B-018 추적
│   └── 99_decision_log.md                ← 본 파일 v10
└── archive/
├── 04_index_input_screen.html
└── 05_result_screen.html

- **팀 영향**: PRD 12절 git 커밋 범위 분담 그대로 유지.
- **영향 범위**: 전체 프로젝트 자산 위치, 배포 환경

### #8. v0.1 명세서 검증 완료 + 버전별 폴더 구조

- **결정일**: 2026-04-28
- **결정**:
  - v0.1.1 명세서를 v0.1 코드 구현의 기준으로 확정
  - 버전별 명세서·테스트 케이스는 docs/v{버전}/ 폴더 하위에 둔다
  - Code 작업지시서 위치는 docs/05_code_work_orders/{번호}_{작업명}.md
- **검증 결과**:
  - TC-001~005 5건 모두 검증팀 손계산·Claude 명세서·홈택스 모의계산 3자 일치
  - PRD 11절 KPI "정답 일치율 90% 이상"을 100% 달성
- **세부 사항**:
  - 13단계 파이프라인 산식 확정
  - 비조정대상지역·단일 주택·일반과세 범위
  - TC-001~005는 v0.2·v0.3 회귀 검증 골든셋
  - v0.1.0 → v0.1.1로 10건 패치(P1~P10) 반영
- **영향 범위**: 명세서·코드·검증·발표 데모 전체

### #9. 작업 창 분담 원칙 (2026-04-29 v8 정정 → v9 사후 인정 확정 반영)

- **결정일**: 2026-04-29 (v7 초안 → v8 정정 → v9 사후 인정 확정)
- **배경**: 4/28 작업 창 #1-1이 tax_rules.js와 tax_rules.test.js를 직접 산출했으나, 작업 창 #1-1 자신의 사후 분석에서 이는 Claude Code의 책임 영역을 침범한 것임이 드러남.
- **결정**: 작업 창 간 산출물 분담을 다음과 같이 명문화한다.

  | 작업 창 | 책임 산출물 | 금지 산출물 |
  |---|---|---|
  | 작업 창 #1 (명세서) | 명세서, 입력 스키마, 골든셋, 검증 결과 | 코드(.js) |
  | 작업 창 #1-1 (코드/룰 설계) | 모듈 스펙(.md), 작업지시서(.md), 의사결정 로그 갱신 | .js 코드 최종 산출 |
  | 작업 창 #5 (의사결정 검토) | 의사결정 검토 보고서, 의사결정 로그 본문 초안 | 결정 권한 (총괄창 권한) |
  | Claude Code | 실제 .js 코드 작성, 테스트 코드 작성, git 영속화 | — |

- **세부 적용**:
  - 작업 창 #1-1·#5의 .js 산출물은 참고 코드 골격(reference skeleton) 수준까지만 허용. 완성된 코드 전체 산출 금지.
  - 작업지시서는 "참고 골격 없이도" Claude Code가 단독 작성 가능하도록 충분히 상세해야 함.
  - 실제 .js 파일의 영속화(GitHub repo의 js/, tests/)는 Claude Code의 단일 책임.

- **사후 처리 (4/28 사고 정리) — 4/29 검증 통과로 확정 완료**:
  - Claude Code 4단계 점검 (회귀 테스트 어서션 분석 + 모듈 스펙 정합성 + 명세서 정합성 + 종합 보고): ✅ 통과
  - .NET IEEE 754 double 직접 연산 (PowerShell): ✅ 7개 등식 모두 eq=True int=True
  - 사용자 PC Node.js 회귀 테스트 실제 실행: ✅ 67건 통과 / 0건 실패
  - 사후 인정 확정: js/tax_rules.js와 tests/tax_rules.test.js를 v0.1 코드 자산으로 정식 인정. GitHub repo 영구 보존.

- **첫 본격 적용 사례 (2026-04-29 4/29 오후)**:
  - 작업 창 #4 (작업지시서 02 작성 전용) 신설하여 tax_engine.md 모듈 스펙 + 02_tax_engine.md 작업지시서 산출
  - Claude Code가 작업지시서 02 단독 받아 js/tax_engine.js + tests/tax_engine.test.js 신규 작성 + 자체 회귀 테스트 234/0 통과
  - GitHub Pages 라이브 검증 (사용자 콘솔 직접 호출, totalTax 98,241,000 명세서 일치)
  - 의사결정 #9 v9 정상 작동 입증

- **재발 방지**:
  - 향후 모든 작업 창은 본 #9 원칙을 따름
  - 백로그 B-006 (회귀 테스트 자동화 GitHub Actions)로 사후 인정 절차 자동화 추적

- **영향 범위**: 모든 작업 창 분담, Code 작업지시서 작성 원칙, 코드 작업 흐름

### #10. 시나리오 비교 1순위 정렬 지표 (D안 + 보강 4건)

- **결정일**: 2026-04-30
- **선행 백로그**: B-008 (2026-04-29 등록 → 본 결정으로 closure)
- **검토 출처**: 작업 창 #5 (의사결정 #10 심층 검토 전용) — 8개 측면 비교, SWOT 분석, 추가 검토(증여·보유세·조특법 특례)

- **배경**:
  - PRD 5-1 P0 메시지("순서·시점 비교로 세후 실수령액 차이 발생 + 절세 최적 조합 추천")가 시나리오 종류에 따라 정합성이 어긋남.
  - 시나리오 1(어느 1채를 팔까)에서 netAfterTaxSaleAmount 1순위는 양도가액에 종속되어 "비싼 주택을 팔라"는 무의미한 답을 산출.
  - 사용자(Gim) 4/29 우려 — "절세 최적화"라는 PRD 의도와 어긋남.
  - 시나리오 2(전부 양도, 순서 비교)와 시나리오 3(시점 분산)에서는 합계 salePrice가 동일하므로 후보 A·B·C 모두 같은 순위 산출. 쟁점은 시나리오 1에 한정.
  - 명세서 v0.1.1 §4-1은 이미 metrics 3개(totalTax, netAfterTaxSaleAmount, effectiveTaxRate)를 사전 노출하여 본 결정의 인터페이스를 마련해 둠.

- **결정**: D안(시나리오 종류별 1순위 정렬 지표 분기) 채택 + 확장성 보강 4건 채택.
  - 보강 (1): 정렬 함수 metricKey 인자 패턴 + 룰 테이블화
  - 보강 (2): 시나리오 종류 식별을 enum이 아닌 차원 태그(dimensions) 방식
  - 보강 (3): scenarioResult에 actions[]·referenceYear 메타를 v0.3부터 미리 노출
  - 보강 (4): House에 specialTaxFlags·specialTaxRequirementsMet 필드를 v0.1부터 미리 추가 (v0.6+ 활성)

- **이유**:
  - 사용자 우려 정면 대응 — 시나리오 1 무력화 문제 해소.
  - PRD 5-1·6-3 메시지 보존 — 시나리오 2·3에서 "세후 실수령액 최대" 메시지를 그대로 유지. PRD 본문 수정 불요.
  - 명세서 v0.1.1 metrics 사전 노출 작업과 100% 정합. v0.3 진입 부담 사전 감소(B-008 처리 방향에 명시된 효과).
  - 5/7 발표 D-7 시점에 분기 로직 구현 부담 적음(약 10~15줄).
  - 보강 4건은 v0.5 증여·v0.6 보유세·v0.6+ 조특법 특례주택 확장 시 데이터 모델·분기 구조 재설계를 방지하기 위한 사전 인터페이스 확장점. 누적 추가 비용 약 15~20줄.

- **세부 적용**:

  **(A) 시나리오 종류 차원 태그 식별 함수 — `classifyScenarioDimensions(salePlan)`**

```js
  {
    hasMultipleCandidates: salePlan.candidateHouseIds.length > 1
                           && salePlan.fixedSaleHouseIds.length === 0,
    hasOrderingDecision:   salePlan.targetSaleCount >= 2,
    hasTimingSpread:       salePlan.allowYearSplitting === true
                           && salePlan.targetSaleYears.length >= 2
    // (참고용 주석) v0.5+ 확장 시 추가 가능: hasGiftOption, hasHoldingTaxView
    // (참고용 주석) v0.6+ 확장 시 추가 가능: hasSpecialTaxHouse
  }
```

  **(B) 시나리오 종류 식별 룰 + 1순위 정렬 지표 매핑 (룰 테이블)**

  | 우선순위 | 식별 조건 | 시나리오 종류 | 1순위 metricKey | 정렬 방향 |
  |---|---|---|---|---|
  | 1 | hasTimingSpread === true | TYPE_3_TIMING | netAfterTaxSaleAmount (합계) | desc |
  | 2 | hasMultipleCandidates === true AND hasOrderingDecision === false | TYPE_1_WHICH_ONE | effectiveTaxRate | asc |
  | 3 | (그 외 모든 케이스) | TYPE_2_ORDER | netAfterTaxSaleAmount (합계) | desc |

  결합 케이스(시나리오 1+2+3 복합) 처리: 위 우선순위에 따라 시점 분산이 활성이면 무조건 TYPE_3_TIMING이 우선 적용된다.

  **(C) 정렬 함수 시그니처 (metricKey 인자 패턴)**

```js
  sortScenariosByMetric(scenarios, metricKey, order)
  recommendBestScenario(scenarios, salePlan)  // (A)·(B) 통합 진입점
```

  metricKey 룰 테이블은 scenario_engine.js에 상수로 보유하며 v0.5+ 신규 지표(householdNetWealthNPV 등) 추가 시 룰 테이블 한 줄 추가만으로 확장.

  **(D) 시나리오 1 보조 결정 — effectiveTaxRate 채택 (totalTax 아님)**
  
  시나리오 1에서 effectiveTaxRate를 1순위로 채택. 양도가액으로 정규화된 효율성 비교가 사용자 의도("어느 주택이 절세 효율 우수한가")에 가장 적합. totalTax는 양도가액에 약하게 결부되어(작은 주택은 세금도 작음) 절댓값 비교의 의미가 제한됨.

  **(E) scenarioResult 메타 보강 (v0.3부터)**

```js
  scenarioResult = {
    scenarioId:    string,
    scenarioType:  "TYPE_1_WHICH_ONE" | "TYPE_2_ORDER" | "TYPE_3_TIMING",
    dimensions: {
      hasMultipleCandidates: boolean,
      hasOrderingDecision:   boolean,
      hasTimingSpread:       boolean
    },
    
    // v0.5+ 확장 대비 사전 노출 — v0.3에서는 모든 actions의 type === 'sale'
    actions: [{
      type:     "sale",          // v0.5+: "sale" | "gift" | "partial_gift" | "hold"
      houseId:  string,
      year:     number,
      amount:   number,
      taxpayer: "self"           // v0.5+: "self" | "recipient"
    }],
    referenceYear:         number,    // 비교 기준 연도, v0.5+ NPV 계산 baseline
    
    metrics: {
      totalTax:              number,
      netAfterTaxSaleAmount: number,
      effectiveTaxRate:      number | null
    },
    perTransactionResults: taxResult[]  // 행위별 taxResult 배열
  }
```

  scenarioType과 dimensions 모두 노출. 결과 화면은 scenarioType 기반 캡션을 사용하고, v0.5+ 확장 시 dimensions를 활용한다.

  **(F) 결과 화면 표시 정책**

  - 비교표에 3개 지표(totalTax, netAfterTaxSaleAmount, effectiveTaxRate) 모두 컬럼으로 표시.
  - 1순위 정렬 지표 컬럼만 시각 강조(green badge 또는 굵은 글씨).
  - 표 헤더 또는 캡션에 시나리오 종류 명시(예: "TYPE_1_WHICH_ONE: 어느 1채를 양도할지 비교").

- **부수 결정**:

  | # | 항목 | 결정 |
  |---|---|---|
  | 1 | 결과 화면 지표 노출 | 3개 모두 표시 + 1순위 시각 강조 |
  | 2 | 동순위 처리(tiebreaker) | ① Σ totalTax 오름차순 → ② effectiveTaxRate 오름차순 → ③ 시나리오 ID 사전순 (재현성 보장) |
  | 3 | 시나리오 종류 사용자 직접 선택 | v0.3 미지원. salePlan 7개 필드로 자동 식별. v0.5 이후 검토 |
  | 4 | 결합 케이스 우선순위 | 시점 분산 활성 시 TYPE_3_TIMING 우선 |
  | 5 | 시나리오 1의 1순위 | effectiveTaxRate (totalTax 아님) |

- **입력 스키마 v0.1.2 패치 (본 결정과 함께 적용)**:
  - `docs/v0.1/03_input_schema.md`를 v0.1.2로 패치
  - House에 `specialTaxFlags` (선택 필드, v0.1 미사용, v0.6+ 활성) + `specialTaxRequirementsMet` (선택 필드, 동일) 추가
  - v0.1 누락 시 자동 보정값 적용 (입력 스키마 §2-4에 명시)
  - **`tax_engine.js`의 validateCaseData 자동 보정 로직은 v0.2 시점에 추가** (v0.1 회귀 안전성 보장 — TC-001~005는 두 필드 미입력 상태 그대로 통과)

- **재검토 시점**:
  - **5/4 v0.3 검증 완료 시점** — 골든셋(시나리오 종류별 1건 이상)이 모두 통과하는지
  - **5/5 발표 데모 케이스 결정 시점** — 데모 케이스의 시나리오 종류 확정, 발표 PT 보조 슬라이드 검토(B-018)
  - **6/11 최종 발표 후 회고 시점** — D안 분기가 사용자에게 자연스러웠는지 검증
  - **v0.5 진입 시점** — 증여·보유세 통합 지표(B-010 householdNetWealthNPV)와 함께 1순위 정렬 지표 재정의. NPV 할인율 가정(B-011) 결정. 지표명 일반화 리팩터(B-013) 검토
  - **v0.6 진입 시점** — 조특법 특례주택(B-014~B-017) 흡수 시 차원 태그 추가(hasSpecialTaxHouse)와 후보군 자동 축소 정책 결정

- **영향 범위**:

  | 대상 | 변경 내용 |
  |---|---|
  | js/scenario_engine.js | v0.3 신규 작성. classifyScenarioDimensions, sortScenariosByMetric, recommendBestScenario 함수. SCENARIO_METRIC_RULES 상수 |
  | js/tax_engine.js | 기존 metrics 노출 그대로 유지. v0.2 시점에 validateCaseData 자동 보정 로직 추가 |
  | docs/v0.3/01_calc_engine_spec.md | v0.3 신규 작성 |
  | docs/v0.3/modules/scenario_engine.md | v0.3 신규 작성. 본 결정의 룰 테이블·정렬 함수 계약 |
  | docs/05_code_work_orders/03_scenario_engine.md | v0.3 신규 작성 |
  | docs/v0.1/03_input_schema.md | 본 결정과 함께 v0.1.2로 패치 — House에 specialTaxFlags·specialTaxRequirementsMet 필드 추가 |
  | result.html | v0.4 동적 렌더링 시 3개 지표 컬럼 + 1순위 강조 + 시나리오 종류 캡션 적용 |
  | 발표 PT (PRD) | 본문 수정 불요. 5/5 발표 데모 케이스 결정 시점에 보조 슬라이드 검토(B-018) |
  | 백로그 | B-008 closure. B-009~B-018 신규 등록 |

- **연관 백로그**:
  - 처리 완료: B-008 (의사결정 #10으로 closure)
  - 신규 등록: B-009(validateCaseData 단축형 노출), B-010~B-017(작업 창 #5 제안 8건), B-018(5/7 발표 PT 보조 슬라이드)

---

## 폐기/번복된 의사결정 (Deprecated)

### #9 (v7 초안 — 2026-04-29 v8에서 정정)
- **초안**: "작업지시서가 다른 작업 창에서 선행 완성된 경우 검증·확인 작업으로 재해석"
- **폐기 사유**: 사후 처리만 다루고 예방 원칙이 빠져 있음. 작업 창 #1-1의 자체 분석에서 더 근본적인 분담 원칙이 필요함을 확인.
- **대체**: v8 #9 (작업 창 분담 원칙 명문화 + 사후 처리 절차 통합)

---

## 일정·진행 상황 (참고용 — 변경 빈번하므로 의사결정 로그 갱신 트리거 아님)

### 산출물 진행 상황 (2026-04-30 기준)

| 산출물 | 상태 | 영속화 |
|---|---|---|
| 의사결정 로그 v10 | ✅ 본 파일 | docs/99_decision_log.md (Claude.ai 업로드 필요) |
| 백로그 (B-001~B-018) | ✅ 작성 완료 (B-009~B-018 4/30 등록) | docs/98_backlog.md |
| salePlan UI 설계 | ✅ 검증 통과 | docs/02_saleplan_ui_design.md |
| 수기 정답 양식 | ✅ 작성 완료 | docs/04_test_cases_manual.xlsx |
| 명세서 v0.1.1 | ✅ 검증 통과 (3자 일치) | docs/v0.1/01_calc_engine_spec.md |
| 입력 스키마 v0.1.2 | ✅ 의사결정 #10 패치 적용 | docs/v0.1/03_input_schema.md |
| TC-001~005 골든셋 | ✅ 검증 통과 (100%) | docs/v0.1/06_test_cases.md |
| tax_rules 모듈 스펙 v0.1.1 | ✅ 작성 완료 | docs/v0.1/modules/tax_rules.md |
| tax_engine 모듈 스펙 v0.1.1 | ✅ 작성 완료 | docs/v0.1/modules/tax_engine.md |
| tax_rules.js v0.1.1 | ✅ selfTest ok: true + Node.js 67/0 (사후 인정 확정 #9) | js/tax_rules.js |
| tax_rules.test.js | ✅ 회귀 테스트 67건 | tests/tax_rules.test.js |
| tax_engine.js v0.1.1 | ✅ Node.js 234/0 + GitHub Pages 라이브 검증 통과 | js/tax_engine.js |
| tax_engine.test.js | ✅ 회귀 테스트 234건 | tests/tax_engine.test.js |
| 작업지시서 01 (tax_rules) | ✅ 검증 활용 완료 | docs/05_code_work_orders/01_tax_rules.md |
| 작업지시서 02 (tax_engine) | ✅ Claude Code 신규 작성 활용 완료 | docs/05_code_work_orders/02_tax_engine.md |
| index.html 승격 | ✅ ②.5 카드 + tax_rules.js + tax_engine.js 연결 + GitHub Pages 검증 | repo root |
| **v0.2 명세서 (장특공·비과세)** | ⏳ 4/30 시작 | docs/v0.2/ |

### 일정표 (2026-04-30 기준 D-7)

| 날짜 | 핵심 작업 | 마일스톤 |
|---|---|---|
| 4/27 (월) ✅ | 의사결정 #1~#7, salePlan UI, GitHub repo, tax_rules.js v0.1, xlsx 양식 | |
| 4/28 (화) ✅ | 명세서 v0.1.1 검증 통과 (3자 일치), 영속화 일괄 (6건), index.html 승격 | 명세서 검증 완료 |
| 4/29 (수) ✅ | 의사결정 v8·v9, Claude Code 첫 도입 (검증 + 신규 작성), tax_engine.js 234/0, GitHub Pages 라이브 검증 | **v0.1 코드 완료** |
| 4/30 (목) ⏳ | 의사결정 v10 (#10 신규), 백로그 B-009~B-018, 입력 스키마 v0.1.2, v0.2 명세서 시작, 검증팀 v0.2 손계산 | |
| 5/1 (금) | v0.2 검증 완료, v0.2 코드 작업지시서·실행 | v0.2 완료 |
| 5/2 (토) ~ 5/3 (일) | v0.3 명세·코드 (다주택 중과·시나리오 엔진 — #10 적용) | |
| 5/4 (월) | v0.3 검증, 수기 정답 대조 | v0.3 완료 |
| 5/5 (화) | result.html 동적 렌더링, 발표 데모 케이스 결정, 발표 PT 보조 슬라이드 (B-018) | |
| 5/6 (수) | v0.4 엔드투엔드, 발표 리허설 | v0.4 완료 |
| 5/7 (목) | 2차 발표 | D-day |