<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Sources for the five example quizzes

Checked on 12 Oct 2026. Wikipedia pages were read in full or by targeted excerpt (the page URL is the citation). Repo references are file:line against branch `v1` at 5c2b397c.

Anything marked CHECK is something a reviewer should look at before it ships. Everything else was verified against the source named.

## 1. World geography (world-geography.json)

| Q | Claim | Source |
| - | - | - |
| 1 | Canberra is the capital of Australia (Sydney and Melbourne are not) | https://en.wikipedia.org/wiki/Canberra ("is the capital city of Australia"; chosen as a compromise between Sydney and Melbourne) |
| 2 | The Nile is the longest river in Africa (about 6,650 km), ahead of the Congo (4,700 km) and the Niger (4,180 km) | https://www.worldatlas.com/rivers/10-longest-rivers-in-africa.html ; https://www.statista.com/statistics/1237679/longest-rivers-in-africa/ . The question says "in Africa" on purpose, because the Nile against the Amazon for longest in the world is disputed |
| 3 | The Pacific is the largest ocean (165,250,000 km2) | https://en.wikipedia.org/wiki/Pacific_Ocean ("the largest and deepest of Earth's five oceanic divisions") |
| 4 | Mount Kilimanjaro is in Tanzania and is the highest mountain in Africa (5,895 m) | https://en.wikipedia.org/wiki/Mount_Kilimanjaro |
| 5 | Russia has the largest area (17,098,246 km2), then Canada, China, United States | https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_area |
| 6 | Switzerland and Bolivia are landlocked. Peru (Pacific coast) and Portugal (Atlantic coast) are not | https://en.wikipedia.org/wiki/Landlocked_country (Switzerland and Bolivia listed; Peru and Portugal absent) ; https://en.wikipedia.org/wiki/Peru ("bordered to the south and west by the Pacific Ocean"). Portugal's Atlantic coast is not in the excerpt I could read, only its absence from the landlocked list and its Atlantic archipelagos, but it is plain on any map |
| 7 | Ottawa is the capital of Canada | https://en.wikipedia.org/wiki/Ottawa |
| 8 | The Seine flows through Paris | https://en.wikipedia.org/wiki/Seine ("flowing through Paris and into the English Channel at Le Havre") |
| 9 | Italy and Egypt have a Mediterranean coast. Portugal and Germany do not | https://en.wikipedia.org/wiki/Mediterranean_Sea (infobox "Coastal countries": Italy and Egypt listed; Portugal and Germany not) |
| 10 | Greenland is the world's largest island | https://en.wikipedia.org/wiki/Greenland ("the world's largest island"). By convention Australia counts as a continent, not an island. Low risk |
| 11 | The Sahara is the largest hot desert (about 9,200,000 km2). "Hot" is in the question because Antarctica is larger overall | https://en.wikipedia.org/wiki/Sahara |
| 12 | The Andes run along the western edge of South America and are the longest continental mountain range | https://en.wikipedia.org/wiki/Andes |

## 2. Science basics (science-basics.json)

| Q | Claim | Source |
| - | - | - |
| 1 | Jupiter is the largest planet in the solar system | https://science.nasa.gov/solar-system/planets/ ; https://en.wikipedia.org/wiki/Jupiter |
| 2 | Plants take in carbon dioxide for photosynthesis and release oxygen | https://en.wikipedia.org/wiki/Photosynthesis (CO2 + H2O + light energy -> carbohydrate + O2) |
| 3 | Water boils at 100 degrees Celsius at sea level (99.97 to be exact, rounded) | https://en.wikipedia.org/wiki/Boiling_point ("boils at 100 C, rounded from 99.97 C, under standard pressure at sea level") |
| 4 | Gold is Au (from Latin aurum). Ag is silver, Pb is lead, Gd is gadolinium | https://en.wikipedia.org/wiki/Gold |
| 5 | An adult human has 206 bones (a newborn has about 270) | https://en.wikipedia.org/wiki/Human_skeleton . Individuals vary slightly (extra ribs and so on), but 206 is the standard figure |
| 6 | Dry air is 78.08% nitrogen, 20.95% oxygen, 0.93% argon | https://en.wikipedia.org/wiki/Atmosphere_of_Earth |
| 7 | Adult insects have six legs (three pairs on the thorax). "Adult" is in the question because some larvae have extra leg-like limbs. Spiders have eight and are not insects | https://en.wikipedia.org/wiki/Insect |
| 8 | Dolphins and bats are mammals. Sharks are fish and penguins are birds | https://en.wikipedia.org/wiki/Dolphin ; https://en.wikipedia.org/wiki/Bat ; https://en.wikipedia.org/wiki/Shark ; https://en.wikipedia.org/wiki/Penguin |
| 9 | Mars and Neptune are planets. Sirius is a star and Europa is a moon of Jupiter. Pluto was left out on purpose | https://science.nasa.gov/solar-system/planets/ (eight planets; Pluto reclassified in 2006) ; https://en.wikipedia.org/wiki/Sirius ; https://en.wikipedia.org/wiki/Europa_(moon) |
| 10 | Planets orbit the Sun because of gravity | https://en.wikipedia.org/wiki/Gravity ("Planets orbit the Sun in an ellipse as a consequence of the law of gravity") |
| 11 | Diamond has the highest hardness of any natural material (Mohs 10). Quartz is 7 | https://en.wikipedia.org/wiki/Diamond |
| 12 | Red blood cells carry oxygen (haemoglobin carries over 98% of it) | https://en.wikipedia.org/wiki/Red_blood_cell |

## 3. Food around the world (food-around-the-world.json)

| Q | Claim | Source |
| - | - | - |
| 1 | Sushi is a traditional Japanese dish of vinegared rice | https://en.wikipedia.org/wiki/Sushi |
| 2 | Paella is a rice dish from the Valencian Community in Spain; saffron is a standard ingredient | https://en.wikipedia.org/wiki/Paella |
| 3 | Guacamole is an avocado-based dip first developed in Mexico. The wrong answers are not ingredients of it | https://en.wikipedia.org/wiki/Guacamole |
| 4 | Modern pizza evolved from flatbreads in Naples in the 18th or early 19th century. The craft of the Neapolitan pizzaiuolo is on UNESCO's intangible heritage list (2017) | https://en.wikipedia.org/wiki/Pizza ; https://www.ansa.it/english/news/2017/12/07/art-of-neapolitan-pizza-wins-unesco-status-2_065791cc-e6fe-41b4-8d40-fc35f1c10ce9.html . The question says "modern pizza" because flatbreads with toppings are much older |
| 5 | Kimchi is a traditional Korean side dish of salted, fermented vegetables, most often napa cabbage, with chilli | https://en.wikipedia.org/wiki/Kimchi |
| 6 | Hummus is made from cooked, mashed chickpeas blended with tahini, lemon juice and garlic | https://en.wikipedia.org/wiki/Hummus |
| 7 | Tofu is made by pressing the curds of coagulated soy milk, so from soybeans | https://en.wikipedia.org/wiki/Tofu |
| 8 | Turmeric gives curry powder its yellow colour (curcumin) | https://en.wikipedia.org/wiki/Turmeric |
| 9 | Brazil is the largest coffee producer: 31% of the world's green coffee in 2023 (FAOSTAT, via Wikipedia), about 36% to 38% by USDA estimates | https://en.wikipedia.org/wiki/Coffee ; https://safras.com.br/eng/usda-reduces-world-coffee-production-by-1-3-for-22-23-projected-now-at-172-75-mln-bags/ (USDA: Brazil 36%, Vietnam 17%, Colombia 7%). Shares move by season, but the ranking has not changed in years, so "the most" holds |
| 10 | Lasagne and risotto are Italian. Pad thai is Thai and paella is Spanish | https://en.wikipedia.org/wiki/Lasagne ; https://en.wikipedia.org/wiki/Risotto ; https://en.wikipedia.org/wiki/Pad_thai ; https://en.wikipedia.org/wiki/Paella |
| 11 | Pizza Margherita has tomatoes, mozzarella and basil. Pineapple is not on it | https://en.wikipedia.org/wiki/Pizza ("Tomatoes, mozzarella, basil") ; https://en.wikipedia.org/wiki/Pizza_Margherita (also olive oil; no pineapple) |
| 12 | Feta is a Greek white brined cheese made from sheep's milk, or sheep's milk with up to 30% goat's milk; protected as a Greek product in the EU since 2002 | https://en.wikipedia.org/wiki/Feta ; https://agriculture.ec.europa.eu/farming/geographical-indications-and-quality-schemes/geographical-indications-food-and-drink/feta-pdo_en |

## 4. How frogQuiz works (frogquiz-onboarding.json)

Repo paths are relative to C:\dev\frogQuiz. Line numbers are from the working tree on 12 Oct and will drift.

| Q | Claim | Source |
| - | - | - |
| 1 | Players join with the 6-digit PIN and a nickname (at least 2 characters). They need no account. Making and hosting need a team account | frontend/src/lib/i18n/locales/en.json:7 ("Enter the 6-digit PIN from the host's screen."), :13 ("Making and hosting a quiz needs a team account. Players only need the PIN."), :556 (nickname heading); frontend/src/lib/play/join.svelte:50 (MIN_NICKNAME = 2); frogquiz/routers/quiz.py:194 (PIN is randint(100000, 999999)); MVP.md:216 (D23); frogquiz/config.py:132 (anonymous_quizzes_enabled defaults to False) |
| 2 | By default a phone shows coloured shapes, and the question is read from the host's screen. The host can turn on "Show questions and answers on players' devices", which is off by default | frontend/src/lib/dashboard/start_game.svelte:40 (show_on_devices = false) and :78 (game_mode is 'kahoot' when off); frontend/src/lib/play/question.svelte:273 (AnswerShape drawn when game_mode is 'kahoot', answer text otherwise); en.json:764 ("Off, players see four colored shapes and read the question from your screen.") |
| 3 | Sign-in is by an emailed link or a six-digit code. Passwords are off. CHECK: this holds for production only if the VM's .env does not set ENABLE_PASSWORD_LOGIN | en.json:57 and :61 ("We sent a link and a six-digit code ... Open the link, or type the code here."); frontend/src/routes/account/login/+page.svelte:9-14; frogquiz/config.py:126 (enable_password_login = False); frogquiz/routers/login.py:121 (password login answers 404 when off); MVP.md:214 (D21). The "QR code on the sign-in page" distractor does not exist: there is no QR step in the login page |
| 4 | Sign-in accepts @frog.co and @capgemini.com only. CHECK: confirm the VM's .env does not override ALLOWED_EMAIL_DOMAINS (the default is these two) | frogquiz/config.py:122; .env.example:39; docker-compose.yml:91; DEPLOY.md:155; en.json:71 ("Use your @frog.co or @capgemini.com address.") |
| 5 | A question is complete (playable) when it has question text, at least two answers that all have text, and one answer marked correct. A picture is not required (QuizQuestion.image is optional) | frogquiz/helpers/completeness.py:35-50; frontend/src/lib/editor/question_complete.ts:24-40; frogquiz/db/models.py:164 (image defaults to None); MVP.md:207 (D14). The text must be non-blank after stripping markup |
| 6 | A quiz with an unfinished question cannot be hosted. The server answers 400 "This quiz is a draft. Finish question N in the editor first." and the Play button is disabled | frogquiz/routers/quiz.py:184-192; frontend/src/routes/view/[quiz_id]/+page.svelte:393 (disabled={!can_start \|\| is_draft}); en.json:858 ("This quiz is a draft. Finish the questions marked in the editor, then it can be played.") |
| 7 | Public quizzes appear in Discover. Unlisted quizzes can only be opened by someone with the link. Only the owner can edit, and unlisted quizzes are not deleted after a day (account quizzes are kept) | en.json:258 (editor.visibility_hint); frontend/src/lib/editor/settings-card.svelte:174-193; en.json:144 and :182 (labels "Public" and "Unlisted"); view/[quiz_id]/+page.svelte:405 (Edit only `{#if is_owner}`); docs/anonymous-vs-account.md:36 (lifetime: kept). MVP.md:217 (D24, v0.8) will add a Private level; the answer to this question stays true after that |
| 8 | The Play button on a quiz's page (and on its row in My Quizzes) opens the Start game window, which creates the lobby. Practice is a solo run with no timer. Download is owner only | frontend/src/routes/view/[quiz_id]/+page.svelte:393-402 and :411 (Practice link); frontend/src/routes/my-quizzes/+page.svelte:256-259; frontend/src/lib/dashboard/start_game.svelte:157 and :239; en.json:138 ("Play"), :190 ("Practice"), :842-843 ("No timer, and nobody sees your score.") |
| 9 | In the lobby the host has Start game (disabled until at least one player joins), Cancel game and Lock game. Show results is an in-game control, not a lobby one | frontend/src/lib/play/admin/game_not_started.svelte:93-98 (Cancel game), :104 (LockToggle), :166 (Start game); frontend/src/lib/play/admin/lock_toggle.svelte (Lock game / Unlock game); en.json:377, :381, :387, :415 |
| 10 | A player can join a game that has started, with no points so far, unless the host has locked it | frogquiz/socket_server/__init__.py:266-270 (comment and `if game_data.locked`); en.json:549 ("The host has locked this game, so nobody new can join."); MVP.md:212 (D19) |
| 11 | Faster correct answers score more: 1000 points inside half a second, falling to 500 at the buzzer. On a 20-second question, 2 seconds is 950 and 15 seconds is 625 | frogquiz/socket_server/__init__.py:97-105 (calculate_score) and :544; MVP.md:213 (D20). Worked out by hand: 1000 x (1 - 2000/20000/2) = 950 and 1000 x (1 - 15000/20000/2) = 625 |
| 12 | A several-answers (CHECK) question is all or nothing: the player must pick every correct option and no others. No partial credit | frogquiz/socket_server/helpers.py:149-167 (check_check_question: "All or nothing ... There is no partial credit, deliberately"); en.json:279 ("All correct answers have to be chosen to score points"); MVP.md:195 (D2) |

Things in this quiz that will go stale: the sign-in domains if Azure single sign-on lands (MVP.md:388), the visibility wording when v0.8 adds Private (D24), and the Play and Practice buttons if the view page is redesigned. Q3 and Q4 should be re-read whenever sign-in changes.

## 5. frog's history (frog-history.json)

Every fact below is in at least two independent public sources, apart from where noted. "frog.co" is frog's own site.

| Q | Claim | Source |
| - | - | - |
| 1 | frog is part of Capgemini (frog.co says "frog, part of Capgemini Invent"; Capgemini lists frog among its brands) | https://www.frog.co/about/ (header and footer) ; https://www.capgemini.com/about-us/who-we-are/our-brands/ ; https://www.frog.co/press-release/frog-enters-a-new-era . No year used (see dropped facts) |
| 2 | CHECK. The name frog is usually explained as an acronym for Federal Republic of Germany, Esslinger's home country | https://en.wikipedia.org/wiki/Frog_Design ("originating from an acronym for Esslinger's home country, the Federal Republic of Germany") ; https://www.immigrantentrepreneurship.org/entries/hartmut-esslinger/ ("frog stands for Federal Republic of Germany"). frog.co and the German Design Council article do not explain the name, and one source adds that it was also a nod to the many frogs in Baden-Wurttemberg. The question says "usually explained" for that reason. Fine to drop if you want only frog-confirmed facts |
| 3 | Hartmut Esslinger founded the firm in 1969 | https://www.frog.co/about/ ("frog's journey began in 1969 when Hartmut Esslinger founded esslinger design") ; https://en.wikipedia.org/wiki/Frog_Design ; https://idsa.org/?p=26400 ("established in Mutlangen, Germany in 1969") ; https://www.german-design-council.de/en/design-perspectives/article-detail/the-frog-snow-white-and-the-apple ("in Altensteig in the Black Forest in 1969") |
| 4 | It was first called esslinger design | https://www.frog.co/about/ ; https://en.wikipedia.org/wiki/Frog_Design ("initially named esslinger design") ; German Design Council article ("In 1982, 'Esslinger Design' became 'frogdesign'") |
| 5 | The name changed to frog design in 1982 | https://en.wikipedia.org/wiki/Frog_Design ; German Design Council article (as above) ; https://www.immigrantentrepreneurship.org/entries/hartmut-esslinger/ ("became frogdesign in 1982"). frog.co gives no year for the rename |
| 6 | Steve Jobs partnered with Esslinger to shape Apple's look | https://idsa.org/?p=26400 ("In 1982, Esslinger partnered with Steve Jobs to create a design strategy") ; https://www.frog.co/about/ ("Esslinger's products caught the eye of Steve Jobs") ; https://en.wikipedia.org/wiki/Hartmut_Esslinger . The question says "in the 1980s" and gives no year |
| 7 | Apple used the Snow White design language from 1984 (the Apple IIc launched on 24 April 1984) | https://en.wikipedia.org/wiki/Snow_White_design_language ("Used by Apple Computer from 1984 to 1990") ; https://idsa.org/?p=26400 ("applied to all of Apple's product lines from 1984 to 1990") ; https://www.frog.co/about/ ("launched in 1984 with the Apple IIc") ; https://en.wikipedia.org/wiki/Apple_IIc ("released on April 24, 1984"). Only the start year is used because the end year differs by source (see dropped facts) |
| 8 | The Apple IIc and the Macintosh II used Snow White. The iMac (1998) and iPad did not; Apple phased Snow White out from 1990 | https://en.wikipedia.org/wiki/Snow_White_design_language (product list: Apple IIc 1984, IIGS 1986, Macintosh II 1987, Macintosh SE 1987 and others; "Beginning in 1990, the Apple Industrial Design Group gradually altered and phased out") ; https://en.wikipedia.org/wiki/Hartmut_Esslinger ("starting with the Apple IIc and including the Macintosh II") ; https://idsa.org/?p=26400 (IIc and Macintosh) |
| 9 | Wega was an early Esslinger client and Sony later bought it | https://idsa.org/?p=26400 ("Sony acquired Wega in the mid-1970s") ; German Design Council article ("after the brand was acquired by Sony in 1974") ; https://www.immigrantentrepreneurship.org/entries/hartmut-esslinger/ ("led Sony to acquire the company in 1974") ; https://en.wikipedia.org/wiki/Hartmut_Esslinger . No year used |
| 10 | After Apple, Jobs founded NeXT, and frog designed the NeXT Computer's cube case | https://en.wikipedia.org/wiki/NeXT ("The case was designed by Hartmut Esslinger and his team at Frog Design"; NeXT founded 1985 by Jobs) ; German Design Council article (NeXT Cube Workstation) ; https://www.immigrantentrepreneurship.org/entries/hartmut-esslinger/ ("chose to have Esslinger design" the NeXT Cube). No year used |
| 11 | "Form follows emotion" is frog's guiding belief (against "form follows function") | https://www.frog.co/designmind/frog50-munich-conversation-hartmut-esslinger-patrica-roller/ ("frog's prevailing mantra, which is the belief that 'form follows emotion'") ; https://idsa.org/?p=26400 ; https://www.red-dot-design-museum.org/essen/exhibitions/design-fundamentals/basic-design-principles/form-follows-emotion . The question does not say who coined it, because one interview has Esslinger crediting Italian design |
| 12 | CHECK. frog has studios in Milan and Munich today | https://www.frog.co/about/ ("Studios at a glance": Paris, San Francisco, Bangalore, Delhi, frog innovation Team, London, Lyon, Madrid, Mexico City, Milan, Munich, New York) ; https://en.wikipedia.org/wiki/Frog_Design (2024 list includes Milan and Munich). The studio list changes (35 studios in the Oct 2021 press release, 12 on the current page), and the two wrong answers (Reykjavik, Anchorage) are right only by absence from the current list. Worth a glance from a frog colleague, or swap the question for something undated |

### Facts I dropped because sources disagree

- Where the firm was founded: Mutlangen (Wikipedia, IDSA, museum-digital), Altensteig (German Design Council, immigrantentrepreneurship.org, which says Altensteig until 2010), "the Black Forest" (frog.co). Only "Germany" is used.
- The year Sony started working with Esslinger or the Trinitron year: 1974 (Esslinger's Wikipedia page, German Design Council), 1975 (frog Design Wikipedia page, for the Trinitron), "mid-1970s" (IDSA). Only the Wega-to-Sony link is used, with no year.
- The Apple deal: the year (1982 in IDSA and Wikipedia, but the Snow White competition ran from July 1982 to February 1983 in the German Design Council article) and the money ($2 million a year on Wikipedia, $1.2 million a year in the German Design Council article). Neither is used.
- Snow White: end year (1990 on Wikipedia and IDSA, 1992 on immigrantentrepreneurship.org), first product (the Apple IIc per frog.co, but Wikipedia says the Lisa 2 came four months earlier), and where the name comes from (Seven Dwarfs code names on Wikipedia, a nod to Braun's SK 4 "Snow White's coffin" in the German Design Council article). Only the 1984 start is used, which holds either way.
- Ownership and money: Flextronics stake (2004 or 2005), sale of the majority (2004 to Flextronics, or 2005 to Aricent on frog.co), KKR (2006), Aricent, Altran, and the year Capgemini took over (2019, 2020 or 2021 across and within sources). Only "part of Capgemini" is used.
- NeXT design year: 1986 (German Design Council), 1987 (Wikipedia), "late 1980s" (immigrantentrepreneurship.org). Only the NeXT link is used.
- Disney MagicBand: the attribution to frog and its dates rest on Wikipedia alone, and the launch year there (2015) does not match when MagicBands rolled out. Not used.
- Time "Design of the Year" and the Whitney collection for the Apple IIc: frog.co claims both, but no source I could open gives the year. Not used.
