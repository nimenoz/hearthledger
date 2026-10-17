# Publishing Hearthledger

Hearthledger is an unofficial companion app for the WoW Forever beta. This guide is the to-do list from the current codebase to live store listings, using Expo Application Services (EAS). Store and Blizzard rules change. Re-check every linked page before you submit.

## 0. Decisions already made in the code

- **Name:** Hearthledger (app.json, package.json, scheme `hearthledger://`, collector bot, Worker name).
- **Bundle ID / package:** `com.nimenoz.hearthledger`, set in `app.json` for both iOS and Android. It cannot change after the first store upload. Change it now if you want another reverse-DNS name.
- **Icon:** generated from code (flame over a ledger bar, gold on dark). Files live in `assets/`. Regenerate or replace them with a designer's final artwork before launch.

## 1. Blockers (do these before any submission)

1. **Connect GitHub and push the repo.** The feed URL depends on it (step 3).
2. **Host the feed.** The collector (`.github/workflows/collect.yml`) writes `data/feed.json` every six hours. Make sure the repo is public, or host the file somewhere public, then set `EXPO_PUBLIC_FEED_URL` (step 3).
3. **Create the Battle.net API client.** Register it at the Blizzard developer portal. Add the Worker callback URL as the redirect URI. Store the secret only in the Worker, never in the app.
4. **Deploy the callback Worker.** Edit `CALLBACK_URL` and `APP_RETURN_URL` in `server/wrangler.toml`, then run `npx wrangler secret put BATTLENET_CLIENT_ID` and `npx wrangler secret put BATTLENET_CLIENT_SECRET`, then `npx wrangler deploy` from `server/`. The Battle.net redirect URI must match `CALLBACK_URL` exactly.
5. **Write a privacy policy** and host it on a public URL. It must cover: Battle.net tokens (kept on the device), what the app reads from the Battle.net API, that no passwords are seen, and how users disconnect or delete local data.
6. **Check trademarks.** The name "Hearthledger" is clear of "World of Warcraft". Keep the in-app and store-listing disclaimer: unofficial fan app, not affiliated with Blizzard Entertainment. Do not use WoW logos or game art in the icon or screenshots without permission.
7. **Ask Blizzard for written permission** before a public launch. The app shows their game data. Read the Blizzard Developer API terms and the trademark guidelines (links at the end).

## 2. Accounts

1. **Expo account** (free): https://expo.dev. Then run:
   ```bash
   npm install -g eas-cli        # or: npx eas-cli@latest <command>
   eas login
   eas init                      # links the project and writes the EAS project ID into app.json
   # eas.json already exists in the repo with development, preview and production profiles. Don't run build:configure.
   ```
2. **Google Play Console**: one-time fee of US$25. https://play.google.com/console. Personal accounts must verify identity. Allow several days.
3. **Apple Developer Program**: US$99 per year. https://developer.apple.com/programs/. Then create the app record in App Store Connect.

## 3. Configure release settings

1. The feed URL is set in each build profile's `env` in [eas.json](../eas.json). It is public, so it's safe to commit. If the repo owner or name changes, update all three profiles.
2. Set the Battle.net client ID in the app environment if the app reads it (check `src/data/armoury/battlenet.ts` for the variable name), using the same method.
3. Bump `version` in `app.json` for each user-visible release.
4. Run the local checks before paying for cloud builds:
   ```bash
   npx tsc --noEmit
   npx vitest run
   npx expo export --platform android
   npx expo export --platform ios
   ```

## 4. Build with EAS

```bash
eas build --platform android --profile production   # .aab for Google Play
eas build --platform ios --profile production       # .ipa for App Store Connect
```

EAS signs the builds in the cloud, so no Mac is needed for iOS. On first run, let EAS create and store the credentials, then back them up with `eas credentials`.

## 5. Google Play

1. In Play Console, choose **Create app**. Complete the setup checklist: privacy policy, app access, ads declaration, content rating questionnaire, target audience, news app declaration, and the **Data safety** form.
2. Submit the first build: `eas submit --platform android --profile production`. For automation, create a Google Cloud service account, download its JSON key, grant it release permissions in Play Console, and keep the key outside the repo. The Play JSON key is not covered by `.gitignore`, so add it explicitly if it is ever stored in the project.
3. **Closed test requirement (personal accounts created after 13 November 2023):** at least **12 testers** opted in continuously for **14 days**, then apply for production access. Plan for this in the timeline.
4. Declare everything the app and its SDKs collect (Data safety). The app has no in-app account, so the account-deletion rule should not apply. If you add accounts later, add in-app and web deletion.
5. Move to production with a staged rollout (10%, 50%, 100%). Watch Android vitals.

## 6. Apple App Store

1. In App Store Connect, create the app with the bundle ID above.
2. Fill in App Privacy to match the code and third-party SDKs. Add the privacy policy URL.
3. Metadata: subtitle, description (include the unofficial-fan-app disclaimer), keywords, support URL, age rating, and screenshots at the sizes Apple currently requires. Use captures from the app only.
4. Review notes: explain that the Battle.net link is optional, and that the news and changes tabs work without an account (they use the bundled seed data).
5. Guideline 4.8 (Sign in with Apple): applies if a third-party login creates the primary app account. Battle.net here only links characters, so it probably does not apply. Re-check the guideline text. If the app gains its own accounts, add Sign in with Apple.
6. Upload: `eas submit --platform ios --profile production`. Create an App Store Connect API key so EAS can submit without prompts. Wait for the build to finish processing.
7. Test the TestFlight build on real devices, then submit for review. Answer export compliance (HTTPS only).

## 7. Updates and feed

- **Feed content** (news and changes) updates without a store release, through the scheduled collector.
- **JavaScript fixes** can ship with `eas update`. Native changes always need a new store build.
- **Monitoring:** Play Console vitals and App Store Connect crash reports.

## 8. Final checklist

- [ ] GitHub repo created and pushed; collector workflow enabled; `data/feed.json` exists and is public.
- [ ] `EXPO_PUBLIC_FEED_URL` in `eas.json` points to the live feed.
- [ ] Battle.net client created; secret only in the Worker; Worker deployed; redirect URI matches exactly.
- [ ] Privacy policy hosted and linked in both stores.
- [ ] Disclaimer present in the app and in listings; no Blizzard logos in icon or screenshots.
- [ ] Blizzard permission requested or confirmed in writing.
- [ ] EAS project linked; credentials backed up; bundle ID final.
- [ ] Google: Data safety done; 12 testers for 14 days; production access applied for.
- [ ] Apple: App Privacy done; TestFlight tested; review notes written.
- [ ] Upload keys (Play JSON, App Store Connect `.p8`, `*.jks`) kept out of git.

## Sources (re-check before submitting)

- Google Play account setup and fee: https://support.google.com/googleplay/android-developer/answer/6112435
- Google Play closed testing requirement: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Apple Developer Program: https://developer.apple.com/programs/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Blizzard Developer API terms: https://www.blizzard.com/legal/a2989b50-5f16-43b1-abec-2ae17cc09dd6/blizzard-developer-api-terms-of-use
- Blizzard trademark guidelines: https://www.blizzard.com/en-sg/legal/38fd0408-8431-469a-99bc-2cd9eb9462c8/blizzard-entertainment-trademark-usage-guidelines
- Expo EAS Submit: https://docs.expo.dev/submit/introduction/
