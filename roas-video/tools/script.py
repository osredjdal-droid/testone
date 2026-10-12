"""The voice-over script (Algerian darija) and how it maps onto scenes.

LINES are the spoken sentences, exactly as sent to ElevenLabs; their words must
match audio/takes/take*.words.json one for one (build_timeline.py checks this).
SCENES group lines; each scene has a section background (Shohraty rhythm:
dark hero → light → tint → … → dark footer, never two dark or two tint in a row)
and the transition that brings it in.
"""

LINES = [
    # 1 · hook
    "واش رايك لوكان نقولك أنو نسبة العائد بثلاثة أضعاف يقدر يكون أحسن من نسبة العائد بستة أضعاف؟",
    # 2-7 · campaign one
    "خليني نشرحلك بمثال.",
    "تخيل صرفت ألف دولار على حملة إشهارية.",
    "رجعتلك ستة آلاف.",
    "يعني كل دولار صرفتو، رجعلك ستة.",
    "نسبة عائد ستة أضعاف.",
    "رقم يفرح، تقول هذي أحسن حملة إعلانية عندك.",
    # 8-12 · scaling up
    "بعدها كبّرت الميزانية.",
    "صرفت أربعة آلاف.",
    "رجعلك اثنا عشر ألف.",
    "نسبة العائد نزلت لثلاثة أضعاف.",
    "حسيت الحملة بدات تضعف، وقررت تنزّل الميزانية باش \"تصلح\" الوضع.",
    # 13 · the mistake
    "هنا الغلطة.",
    # 14-17 · real profit
    "شوف الربح الحقيقي، مش النسبة بركة.",
    "بالنسبة ستة أضعاف: ربحت خمسة آلاف.",
    "بالنسبة ثلاثة أضعاف: ربحت ثمانية آلاف.",
    "الحملة لي حسيت أنها أضعف، جابتلك ثلاثة آلاف زيادة.",
    # 18-20 · ratio vs profit
    "نسبة العائد رقم نسبي.",
    "الربح رقم حقيقي.",
    "هو الفائدة صافية من الإستثمار.",
    # 21 · both at once
    "النسبة تقدر تنزل، والربح يكبر في نفس الوقت.",
    # 22-23 · why: a wider, colder audience
    "لأن كي تكبر الميزانية، راك توصل لجمهور أوسع، أبرد شوية، أصعب يتقنع.",
    "الجودة تنقص، بصح الكمية تزيد.",
    # 24-25 · why businesses stay small
    "غالبية البيزنسات تبقى صغيرة، ماشي لأن نسبة العائد تاعها ضعيفة.",
    "تبقى صغيرة لأنها تخاف من نسبة العائد تنقص، وتوقف الحملة في اللحظة لي كانت راح تكبر فيها.",
    # 26-27 · the rule
    "ماتحوسش غير إذا النسبة العائدة نقصة.",
    "حوس إذا الربح زاد.",
    # 28 · question to the viewer
    "دوك قولي… حبست حملة إعلانية لأن النسبة العائدة بانتلك نقصت؟",
]

# scene id, background, lines (1-based), transition into the scene
SCENES = [
    ("s1",  "dark",  [1],                None),
    ("s2",  "light", [2, 3, 4, 5, 6, 7], "wipe"),
    ("s3",  "tint",  [8, 9, 10, 11, 12], "fade"),
    ("s4",  "dark",  [13],               "wipe"),
    ("s5",  "light", [14, 15, 16, 17],   "fade"),
    ("s6",  "dark",  [18, 19, 20],       "wipe"),
    ("s7",  "tint",  [21],               "fade"),
    ("s8",  "light", [22, 23],           "fade"),
    ("s9",  "tint",  [24, 25],           "fade"),
    ("s10", "dark",  [26, 27],           "wipe"),
    ("s11", "light", [28],               "fade"),
    ("s12", "dark",  [],                 "wipe"),   # end card, no voice
]

LEAD_IN = 0.5          # silence before the first word
SCENE_GAP = {          # extra silence added at a scene change (s) on top of the natural pause
    "default": 0.3,
    "s2": 0.45,        # after the hook question
    "s5": 0.7,         # let "هنا الغلطة." land
}
LAST_TAIL = 2.6        # last word -> end card (the question + CTA stay on screen)
END_CARD = 4.6
