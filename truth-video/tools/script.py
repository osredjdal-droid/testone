"""The voice-over script (Algerian darija) and how it maps onto scenes.

LINES are the spoken lines, exactly as sent to ElevenLabs; their words must match
audio/takes/take*.words.json one for one (build_timeline.py checks this).
A few spellings differ from the brief only so the voice reads them correctly:
«ما شي» → «ماشي», «حقيقة ل البيزنس» → «حقيقية للبيزنس», «تقولوا انوا» → «تقولو أنو»,
«نقولوا نسكتوا» → «نقولو نسكتو», «تسمعوا» → «تسمعو», «الي» → «اللي», «تدي» → «تدّي».
SCENES group lines; each scene has a section background (Shohraty rhythm:
dark hero → light → tint → … → dark footer, never two dark or two tint in a row)
and the transition that brings it in.
"""

LINES = [
    # 1-2 · the client
    "عميل جانا، حكالنا على البيزنس تاعو: العرض، الجمهور، تمركز تاعو في السوق.",
    "طلب منا خطة تسويق.",
    # 3-4 · the easy option
    "كنا نقدرو نديرو حاجة وحدة بسيطة: ناخذو المعلومات كيما جات، نبنيو الخطة عليها، ونمشيو.",
    "لو الخطة نجحت، مليح.",
    # 5-7 · the excuse is ready
    "لو ما نجحتش، السبب جاهز من قبل:",
    "«الجمهور لي اخترتو نتا صغير.»",
    "«العرض لي حددتو ماشي واضح.»",
    # 8-10 · the easy road
    "هذا الطريق الساهلة.",
    "ما فيه ولا مشكلة، ما فيه ولا نقاش صعيب.",
    "الزبون يبقى مرتاح، ونحنا نبقاو محميين.",
    # 11-12 · another road
    "بصح خترنا طريق آخر.",
    "قلنالو الحقيقة كيما هي.",
    # 13-15 · the diagnosis
    "الجمهور صغير.",
    "العرض ماشي واضح.",
    "تمركزك في السوق ما يعبّرش على قيمة حقيقية للبيزنس تاعك.",
    # 16-17 · the temptation to stay quiet
    "علابالنا بلي أي عميل مايحبش تقولو أنو غالط.",
    "حتى ولينا نقولو نسكتو خير.",
    # 18-19 · the hidden cost of silence
    "بصح لو سكتنا، ومشينا في خطة عارفين مسبقا أنها ما راحش تخدم،",
    "كنا راح نضرّو البيزنس تاعو بروحنا، حتى لو هو ما يحسش بيها في وقتاها.",
    # 20-21 · we said it anyway
    "فضّلنا نقولوها من الأول.",
    "حتى لو تكلفنا الراحة تاعنا، حتى لو الزبون ماكانش حاب يسمعها.",
    # 22-23 · fixed the foundation → result
    "قعدنا معاه، صحّحنا الصورة، وبنينا الخطة على القاعدة الصحيحة.",
    "النتيجة طلعت بعيد على اللي كان متوقع.",
    # 24-26 · the difference
    "هذا الفرق بين وكالة تخدم باش تدّي دراهم،",
    "ووكالة تخدم لتحمي البيزنس تاعك،",
    "حتى لو هذا معناه راح تقولك كلام ماشي حاب تسمعو في البداية.",
    # 27-28 · call to action
    "حاب رأي صريح على الاستراتيجية تاعك، ماشي مجاملة؟",
    "تواصل معانا.",
]

# scene id, background, lines (1-based), transition into the scene
SCENES = [
    ("s1",  "dark",  [1, 2],            None),
    ("s2",  "light", [3, 4],            "wipe"),
    ("s3",  "tint",  [5, 6, 7],         "fade"),
    ("s4",  "dark",  [8, 9, 10],        "wipe"),
    ("s5",  "light", [11, 12],          "wipe"),
    ("s6",  "tint",  [13, 14, 15],      "fade"),
    ("s7",  "dark",  [16, 17],          "wipe"),
    ("s8",  "light", [18, 19],          "fade"),
    ("s9",  "tint",  [20, 21],          "fade"),
    ("s10", "dark",  [22, 23],          "wipe"),
    ("s11", "light", [24, 25, 26],      "fade"),
    ("s12", "tint",  [27, 28],          "fade"),
    ("s13", "dark",  [],                "wipe"),   # end card, no voice
]

# Hesitations the voice makes inside a phrase, trimmed in the edit (silence only, never speech):
# (line, index of the word before the pause, longest pause kept in seconds)
TIGHTEN = [
    (26, 7, 0.06),     # «كلام ماشي | حاب تسمعو» must read as one phrase, not «كلام ماشي. حاب تسمعو»
]

LEAD_IN = 0.5          # silence before the first word
SCENE_GAP = {          # extra silence added at a scene change (s) on top of the natural pause
    "default": 0.25,
    "s5": 0.55,        # the turn: «بصح خترنا طريق آخر»
    "s10": 0.4,        # after «…حتى لو الزبون ماكانش حاب يسمعها»
}
LAST_TAIL = 2.4        # last word -> end card (the CTA stays on screen)
END_CARD = 4.6
