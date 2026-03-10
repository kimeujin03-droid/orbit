# Orbit-clean 정리 메모

정리 기준:
- 삭제: `node_modules`, `.next`, `out`, `.vscode`, 각종 zip/가이드 문서, 실험용 `components/home/claude`
- 유지: 실제 앱 소스(`app`, `components/planner`, `components/ui`, `components/voice`, `hooks`, `lib`, `public`, `android`)
- 보완: 음성 일정 분류에 필요한 `utils/scheduleTaxonomy.ts`, `utils/voiceParseWithTaxonomy.ts` 추가

빌드 순서:
1. `npm install`
2. `npm run build`
3. `npm run cap:sync`
4. Android Studio에서 `android` 폴더 열기

주의:
- `android/local.properties`는 삭제했음. 각 PC에서 Android SDK 경로에 맞춰 다시 생성됨.
- 현재 구조는 **Next.js + Capacitor** 기준임. React Native/Expo 전환 잔재는 정리본에서 제외함.
