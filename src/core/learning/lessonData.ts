// The lessons themselves. Our own short wording (never copied from a video or its captions), one
// entry per video or per section of a long video. See lessons.ts for what each field means.

import type { Lesson } from "./lessons.ts";

export const LESSONS: readonly Lesson[] = [
  {
    id: "jens-lesson-01-forward-roll",
    instructor: "jens-kruger",
    title: "First steps: the forward roll with bare fingers",
    order: 1,
    video: {
      id: "P3Vh0jlIcS4",
      title: "Jens Kruger - Beginner Banjo Lesson 1 / Forward Roll",
    },
    topics: ["roll-forward", "pick-hand", "posture-position", "practice-approach", "gear-picks"],
    foundations: [
      "Any banjo will do, open-back or resonator. Start with bare fingers, no finger picks yet, and get a tuner of some kind.",
      "Use the right hand only for now, with three fingers: thumb, index and middle. Ring and little finger can stay out of it at first.",
      "Rest one unused finger on the head for steadiness. A fully open hand is harder to control.",
      "Let the hand drop onto the strings, very relaxed and uncramped.",
      "Thumb plays the 5th string, index the 3rd string, middle the 1st string. Play them in a row and repeat: this is the forward roll.",
      "It is called forward because the fingers go thumb, index, middle. The reverse order, middle, index, thumb, is the backward roll, taught later.",
    ],
    nuance: [
      "Be very even. Speed does not matter, however slow you go.",
      "Sing along with the pattern. This stores it as music, not just finger memory, and the sound matters more than the motion.",
      "Resting fingers on the head deadens the tone a little. He says he will come back to that.",
    ],
    watch:
      "The sound and rhythm of the roll, how the hand rests on the head, and the tuning step. These are shown, not clearly spoken.",
    completeness: "full",
  },
  {
    id: "jens-lesson-02-forward-backward-roll",
    instructor: "jens-kruger",
    title: "The forward-backward roll, eight notes to a bar",
    order: 2,
    video: {
      id: "Eb31RXfA9Mk",
      title: "Jens Kruger - Beginner Banjo Lesson 2 / Forward-Backward Roll",
    },
    topics: ["roll-forward-backward", "pick-hand", "rhythm-timing", "practice-approach"],
    rolls: ["forward-reverse"],
    foundations: [
      "This roll fills one bar with eight different notes.",
      "The first four notes: thumb on the 3rd string, index on the 2nd, middle on the 1st, then the 5th string.",
      "The second half runs back the other way: middle on the 1st string, index on the 2nd, thumb on the 3rd, then middle on the 1st again. That makes eight notes.",
      "The first half moves forward and the second half moves back, which gives the name. Expect to play this roll many, many times.",
      "Practise the first four notes slowly, then the second four, then all eight together.",
    ],
    nuance: [
      "Keep the spacing between notes equal. Even timing is the goal at this stage.",
      "Some discomfort in the hand at the start is normal and passes. Stay relaxed, because tension makes it harder and can cause injury.",
      "Do not play it faster than he does. Finger picks are not needed yet.",
      "Sing along to connect your ear with your fingers.",
    ],
    watch: "The sound and feel of the roll at a slow, even speed.",
    completeness: "full",
  },
  {
    id: "jens-lesson-04-d7-chord",
    instructor: "jens-kruger",
    title: "The D7 chord and moving between G and D7",
    order: 4,
    video: {
      id: "tIWOl1eAlbM",
      title: "Jens Kruger - Beginner Banjo Lesson 4 / D7 Chord",
    },
    topics: ["chords-basic", "chords-changes", "keys-positions", "fretting-hand"],
    foundations: [
      "After G, the next most useful chord is D, taught here in its simple D7 form. He leaves the theory for later.",
      "Middle finger on the 3rd string, 2nd fret. Index finger on the 2nd string, 1st fret.",
      "Bring the index down at a straighter angle, not flat, so it does not touch the neighbouring string.",
      "Keep the thumb behind the neck and the hand fairly straight.",
      "Press only as hard as needed, and close to the fret. That takes much less strength.",
      "Strum the chord, then go back to G. The open 5th string is not really part of the chord.",
    ],
    nuance: [
      "Open G has little tension, like breathing out. D7 wants to resolve, like breathing in. Going between them is tension and relief.",
      "Many bluegrass and old-time tunes use only two chords. Sally Goodin is one he names.",
      "Relax the hand. The aim is clean notes.",
    ],
    watch:
      "The hand shape for D7, the finger angle and how the chord sounds when strummed. All of this is shown more than said.",
    completeness: "full",
  },
  {
    id: "jens-lesson-05-rolls-over-g-and-d7",
    instructor: "jens-kruger",
    title: "Rolling over G and D7, changing the starting string",
    order: 5,
    video: {
      id: "4sNAPO4fnt8",
      title: "Jens Kruger - Beginner Banjo Lesson 5 / Rolls Over G and D7",
    },
    topics: ["roll-forward-backward", "roll-variation", "chords-changes", "practice-approach"],
    foundations: [
      "Play the forward-backward roll over G, then over D7, back and forth, with the same roll each time.",
      "Next, change the roll as well as the chord. Over D7 the roll starts on the 4th string, the low D string, instead of the 3rd.",
      "Make each chord last two rolls. Over G, the first roll starts on the 3rd string and the second on the 5th string.",
      "Over D7 with two rolls, the first starts on the 4th string and the second on the 5th string.",
      "The point is that the chord can stay put while the pattern changes, so you learn to change both.",
    ],
    nuance: [
      "Sing along most of the time. Your left hand now joins the same memory: pressing in one place, playing in another.",
      "He shows a faster version later in the lesson, then asks you to come back when you can play it.",
    ],
    watch:
      "Which notes follow the new starting string on the 4th and 5th strings. He plays them but does not name them.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-06-c-and-e-minor-chords",
    instructor: "jens-kruger",
    title: "C and E minor chords, and being patient with changes",
    order: 6,
    video: {
      id: "A4rw_QoZ_rw",
      title: "Jens Kruger - Beginner Banjo Lesson 6 / C & Em Chord",
    },
    topics: ["chords-basic", "chords-changes", "fretting-hand", "practice-approach"],
    foundations: [
      "C chord: index finger on the 2nd string, 1st fret, as in D7. Middle finger on the 4th string, 2nd fret. Ring finger on the 1st string, 2nd fret.",
      "Put the whole shape down at once, even though at first you place one finger and then the next.",
      "Practise G, then C, then D. Going from C to D the index finger stays still and the middle finger moves to the 3rd string, 2nd fret.",
      "E minor starts from the C shape: lift the index finger.",
    ],
    nuance: [
      "Chord changes are hard if you have never played an instrument. Be kind to yourself and be patient.",
      "Hold a shape for a while, leave it, then come back to it.",
      "Keep the banjo out of its case within reach, and play briefly many times a day.",
      "Your fingers will hurt at first because the calluses are not built yet. The soreness goes quickly.",
    ],
    watch:
      "The exact E minor fingering, which is not clear from his words, and how the hand moves between shapes.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-07-rolls-over-g-em-c-d7",
    instructor: "jens-kruger",
    title: "Rolls over G, Em, C and D7",
    order: 7,
    video: {
      id: "3qXT-EhlgDc",
      title: "Jens Kruger - Beginner Banjo Lesson 7 / Rolls Over G Em C D7",
    },
    topics: [
      "roll-forward-backward",
      "roll-variation",
      "chords-changes",
      "rhythm-timing",
      "practice-approach",
    ],
    foundations: [
      "Over G, start the roll on the 3rd string. Over every other chord learned so far (C, D7 and E minor), start it on the 4th string. He calls these guidelines for now, not fixed rules.",
      "If a chord lasts two bars, the second bar starts on the 5th string. One bar per chord is also fine and halves the time.",
      "Play the progression G, E minor, C, D7, round and round. It can be any progression, but this one is used a lot.",
      "Do not let the chord change interrupt the roll. At first you will stop, and that is unavoidable.",
    ],
    nuance: [
      "For smoother changes, press the strings you will play first, then add the others. Do not put every finger down before you start.",
      "Both hands need thought at once. Play slower, so your thinking stays ahead of your playing.",
      "Keep singing along.",
      "Expect it to take a month or longer to sound nice. Do not compare yourself with others. A few minutes a day is enough.",
    ],
    watch:
      "The notes after the starting string for the 4th-string and 5th-string rolls. He plays them without naming them.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-08-finger-picks",
    instructor: "jens-kruger",
    title: "Choosing and fitting finger picks",
    order: 8,
    video: {
      id: "OIM_YOQyQdM",
      title: "Jens Kruger - Beginner Banjo Lesson 8 / Finger Picks",
    },
    topics: ["gear-picks", "pick-hand", "practice-approach"],
    foundations: [
      "Finger picks are metal, and the brand matters little.",
      "There are two kinds: thin, flexible stainless or nickel-silver picks, and very hard, thick stainless ones. The hard ones last for decades.",
      "He prefers a flexible pick. It acts like a spring, so it adjusts as your fingers swell with heat.",
      "Curve the pick around the finger. The tip should sit in line with the top of the fingernail, so the string always leaves the same point.",
      "Tilt the pick on the hand so the string is struck flat, not by the edge of the pick.",
    ],
    nuance: [
      "A very straight pick moves the string back and forth and the bridge with it. He likes a little angle for traction on the finger.",
      "For the thumb he mainly uses a heavy, large Golden Gate pick. He likes it not too tight, with a longer part over the fingertip.",
      "New picks scratch. Rub them with very fine sandpaper or steel wool to shorten that period.",
      "He carries his picks in a pocket, nested together, with the thumb pick wrapped around them.",
    ],
    watch:
      "How the pick sits on the finger and at what angle it meets the string. Most of this is demonstrated, not spoken.",
    completeness: "full",
  },
  {
    id: "jens-lesson-09-slide-on-the-third-string",
    instructor: "jens-kruger",
    title: "The slide from fret 2 to fret 4 on the 3rd string",
    order: 9,
    video: {
      id: "ROZQhxlN8M0",
      title: "Jens Kruger - Beginner Banjo Lesson 9 / Slide 2-4 On Third",
    },
    topics: ["slide", "roll-forward-backward", "fretting-hand"],
    foundations: [
      "Play the note first, then slide the finger up the string.",
      "Middle finger on the 3rd string, 2nd fret. After the note sounds, slide it up to the 4th fret.",
      "Press close to the fret. Find out how hard to press and how lightly to slide.",
      "Once the middle finger reaches the 4th fret, play the 2nd string with the index finger, in slow motion.",
      "Combine it with the forward-backward roll, slowly. After the first four notes, when you reach the 5th string, take the left hand away and finish the roll on open strings.",
    ],
    nuance: [
      "If the finger sticks on the string, a little dryness helps.",
      "Instead you can slide to the 3rd fret. It has a bluesier flavor, with more weight on the flat note.",
      "He says this slide is very common in bluegrass.",
      "Do not overdo it, or your fingers get sore.",
    ],
    watch:
      "The sound of the slide and the roll with the slide in it, including exactly where in the roll the slide falls. Both are played, not spoken.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-10-slide-and-c-forward-roll",
    instructor: "jens-kruger",
    title: "Forward roll over C, and a short slide piece",
    order: 10,
    video: {
      id: "kWArMWtmx0M",
      title: "Jens Kruger - Beginner Banjo Lesson 10 / Slide and C Forward Roll",
    },
    topics: ["roll-forward", "roll-variation", "slide", "chords-changes", "practice-approach"],
    foundations: [
      "Play a forward roll over the C chord with all fingers down. It fills an eight-note bar.",
      "This roll starts with the index finger on the 2nd string. He describes the notes as groups of three, three and two.",
      "A variation starts the same roll with the thumb on the first note.",
      "Put it together: G with the slide from lesson 9, C with this forward roll, G with the slide again, then D7 with the forward-backward roll.",
    ],
    nuance: [
      "In bluegrass you often fret only the notes you need, which can be faster than holding the whole chord.",
      "Remembering music is easier when you sing. The mechanical action can crowd out the feel of the melody.",
      "The rest of the little piece comes in the next lesson.",
    ],
    watch:
      "The strings and fingers of the eight-note C roll, which he never lists, and the whole short piece, which he plays without talking.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-11-boil-them-cabbage-down-part-2",
    instructor: "jens-kruger",
    title: "Boil Them Cabbage Down, second half, and quarter notes",
    order: 11,
    video: {
      id: "0JYBHC9cxdY",
      title: "Jens Kruger - Beginner Banjo Lesson 11 / Boil Them Cabbage Down",
    },
    topics: ["roll-forward-backward", "slide", "rhythm-timing", "practice-approach"],
    foundations: [
      "Boil Them Cabbage Down is an eight-bar tune. This lesson finishes the second half, after a quick recap of the first four bars.",
      "The recap is the first bar again, then a D7 bar played with the forward-backward roll.",
      "Bar 6 is tricky: G and D7 share the bar. Play four notes on G, including the slide, then four on D7, ending with the last four notes of the forward-backward roll.",
      "Until now you have played only eighth notes. A quarter note lasts twice as long as an eighth note.",
      "A quarter-note pinch uses the thumb and middle finger together.",
      'Count "one and two and". In quarter notes the "ands" are the beats you skip.',
    ],
    nuance: [
      "Take your time. New things are hard, and you do not have to play it at once, however fast he talks.",
      "Stay ahead of yourself in your thinking, do not let it become automatic too soon, and sing along to help.",
      "He plays the demonstration fast and says not to copy that speed. The next lesson is about speed and a more confident right hand.",
    ],
    watch:
      "Which strings the pinch uses, the slide itself, bar 6 and the whole tune are played, not spoken. Watch these parts closely.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-12-three-finger-styles-explained",
    instructor: "jens-kruger",
    title: "Scruggs, single-string and melodic styles",
    order: 12,
    video: {
      id: "IQ0N5rT3N9w",
      title: "Jens Kruger - Beginner Banjo Lesson 12 / Three Finger Styles Explained",
    },
    topics: ["history-players", "melody-single-string", "melody-melodic-style", "roll-other"],
    foundations: [
      "Three names are in common use: Scruggs style, single-string style and melodic style. Jens explains each.",
      "Earl Scruggs did not invent three-finger picking. His step was to build a large vocabulary of licks out of the rolls, including backup playing.",
      "Single-string style plays many notes on one string, often repeated with the index. Don Reno built a stock of such licks from ideas Scruggs had used.",
      "Single string has a second meaning: playing scales guitar-style, with thumb and index going back and forth.",
      "Melodic style came from Bill Keith and Bobby Thompson in the late 1950s or 1960s. You play scale notes so that no string takes more than one note in a row.",
      "In melodic style every note is a melody note, and the notes can then be fitted into a roll.",
    ],
    nuance: [
      "He walks through a G scale this way to show that every note can be a melody note. You do not need to memorise that walk-through.",
      "He says the three styles mix together in the end, along with strumming and other techniques.",
      "He likes the older name Keith style and regrets the change to melodic style.",
    ],
    watch:
      "All the licks and the melodic scale fingering are played, not spoken. The video is the only place to see how the notes sit on the strings.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-13-tablature-explained",
    instructor: "jens-kruger",
    title: "How to read and write tablature",
    order: 13,
    video: {
      id: "HpWPcKh--Uw",
      title: "Jens Kruger - Beginner Banjo Lesson 13 / Tablature Explained",
    },
    topics: ["tablature", "roll-forward-backward", "slide", "rhythm-timing", "practice-approach"],
    foundations: [
      "Tab shows which string to play. The same pitch can be fretted on several strings, so writing the string down avoids confusion.",
      "Draw the strings as lines, with the first string at the bottom and the fifth at the top.",
      "A number on a line is the fret. A finger can be written above for the left hand and below for the right hand.",
      "A roll can be written as right-hand finger names under the lines, for example thumb, index, middle.",
      'For rhythm, leave note values aside at first. An X can mark a beat with no note, and you count "one and two and" over it.',
      "A small s under the numbers marks a slide, such as from fret 2 to fret 4. Hammer-ons and pull-offs are written differently and come in later lessons.",
    ],
    nuance: [
      "The best way to learn tab is to write down what you play, on ruled paper with five lines, one note at a time.",
      "Do not worry about timing at first. You learn it later, together with the playing.",
    ],
    watch:
      "The hand-drawn tab examples and how the X marks are placed in a bar are only on screen. The roll is named by fingers without strings.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-14-bluegrass-banjo-explained",
    instructor: "jens-kruger",
    title: "Two ways to learn: licks and melodies",
    order: 14,
    video: {
      id: "z57GG6uk5Ho",
      title: "Jens Kruger - Beginner Banjo Lesson 14 / Bluegrass Banjo Explained",
    },
    topics: ["endings-licks", "melody-melodic-style", "practice-approach", "improvising"],
    foundations: [
      "There are two ways to learn banjo, and you need both.",
      "Way one is learning licks as building blocks, like vocabulary. They are usually one bar of eighth notes, and you join them into longer sentences.",
      "He suggests that about fifty licks would already make you play well. One new lick a week gives you around fifty in a year.",
      "Bluegrass is made of small riffs and little pieces, not one continuous stream. Some licks stay put and some go somewhere.",
      "Many licks work over a C, D or G chord.",
      "Way two is learning melody. Strum and sing a tune, then find it on the banjo.",
    ],
    nuance: [
      "Every player has favourite mixes of licks. Learn to hear licks as licks, not as one long sequence.",
      "Keep a notebook of melodies you know, such as Christmas carols, and find them on the banjo. A piano can help. This builds your memory of where the notes are.",
      "He says players who know only melodies cannot join a jam without licks. Lick players without melody lack musical understanding.",
      "Melody movement comes mainly from scales and arpeggios, which the next lesson covers.",
    ],
    watch:
      "The example licks, and which chords they fit, are played without names, notes or tab. Watch them to hear what a lick sounds like.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-15-g-scale-tetrachords-arpeggios",
    instructor: "jens-kruger",
    title: "The G scale in two halves, and arpeggios",
    order: 15,
    video: {
      id: "iG7iwQ4uXDY",
      title: "Jens Kruger - Beginner Banjo Lesson 15 / G Scale, Tetra Chords, Arpeggios",
    },
    topics: ["scales", "melody-melodic-style", "improvising", "chords-diatonic"],
    foundations: [
      "Jens builds the G scale from two four-note groups, called tetrachords. The first is G, A, B, C and the second starts on D.",
      "Play a phrase on one group and answer it on the other. He finds this an easy way to compose melodies.",
      "Changing one note, such as using B as the third note, changes the sound of the same call and answer.",
      "An arpeggio is the first, third and fifth notes of the scale played in turn. For a G chord that is G, B, D.",
      "End an arpeggio with the octave, which is the fifth string.",
      "You can add extra notes to an arpeggio for a different flavour.",
    ],
    nuance: [
      "Most melodies move in steps, with the occasional arpeggio skip or octave jump, because those are easy to sing.",
      "Start with a very simple melody. You can always make it more complicated.",
    ],
    watch:
      "The fretting and string choices for the scale and the call-and-answer examples are played, not spoken. The spoken step spacing is unclear, so watch the scale being played.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-16-basic-rhythm",
    instructor: "jens-kruger",
    title: "Basic boom-chaka rhythm for singing along",
    order: 16,
    video: {
      id: "TNzu6rqgia8",
      title: "Jens Kruger - Beginner Banjo Lesson 16 / Basic Rhythm",
    },
    topics: [
      "rhythm-timing",
      "chords-changes",
      "roll-forward-backward",
      "pick-hand",
      "practice-approach",
    ],
    foundations: [
      'Basic rhythm is a guitar-like "boom chaka" pattern for strumming or singing along. It was left until now so you could first get your fingers rolling.',
      "On the G chord, play the thumb on the third string, then index and middle together on the first and second strings, then a low string, and repeat.",
      "On the C chord the pattern starts on the fourth string, and on D it also starts on the fourth string.",
      "Chords can follow any order, and it is easy to sing along as you change.",
      "To vary it, drop in a quick forward-backward roll in place of the four-note pattern now and then.",
    ],
    nuance: [
      "Playing further up the neck sounds softer and warmer. Playing back near the bridge is quieter but still heard in a jam, with fewer finger-pick noises.",
      "Starting on the fourth string for C and D is only an aesthetic suggestion. Try starting on other strings.",
      "Practise with a chord chart of a simple song and sing along, for example You Are My Sunshine.",
    ],
    watch:
      "The exact strings of the patterns, the chord shapes and the roll as played are not clearly spoken. Watch to see the pattern.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-17-forward-roll-and-pauses",
    instructor: "jens-kruger",
    title: "Forward roll with a moving pause, and melody on it",
    order: 17,
    video: {
      id: "mitk6RWcsGE",
      title: "Jens Kruger - Beginner Banjo Lesson 17 / Forward Roll, Home Sweet Home",
    },
    topics: ["roll-forward", "melody-on-roll", "chords-changes", "scales", "practice-approach"],
    foundations: [
      "The forward roll is really important. Jens says a backward roll could do the same job, but he teaches with the forward roll.",
      "Count the roll as seven notes followed by a pause, which makes eight slots with one rest.",
      "The pause can be moved to other places in the pattern. Practise each position until it feels comfortable, then combine the patterns.",
      "To change chords, keep the thumb on the fifth string and the middle finger on the first, and change only what the left hand holds on the other strings.",
      "Add the scale from lesson 15 to make it musical: G open, A, open B, C, D, E.",
      "Melody notes can be played as quarter notes, with forward-roll patterns filling the longer notes.",
    ],
    nuance: [
      "Combining the two forward-roll types with quarter-note back-and-forth lets you play almost anything with practice.",
      "Sing the melody first, find it on the banjo, then put it into a roll.",
    ],
    watch:
      "The strings and fingers of the roll, the pause patterns and the melody examples are played, not spoken. The tune named in the title is never mentioned aloud.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-18-barre-and-d-position",
    instructor: "jens-kruger",
    title: "Barre chords and the D position",
    order: 18,
    video: {
      id: "tW2YtExYE0c",
      title: "Jens Kruger - Beginner Banjo Lesson 18 / Bar & D Position",
    },
    topics: [
      "chords-barre",
      "chords-basic",
      "posture-position",
      "practice-approach",
      "keys-positions",
    ],
    foundations: [
      "Open G needs no fretting. A barre is one finger across the strings. Raising it up the neck, without the fifth string, gives other chords such as A, C and D.",
      "The D position is built from the C chord shape, slid up the neck. The third string then needs the index finger.",
      "Strum all the strings except the fifth.",
      "Once you know the shape, it moves up the neck and gives other chords, including G again.",
      "The shape names the position, wherever it sits. The nut version is the open position, and the D shape at the 12th fret is still called the D position, though the chord is B flat.",
    ],
    nuance: [
      "This is very difficult for a beginner. Be patient. You will not learn something totally new in one session.",
      "Keep the fretting wrist as straight as you can, since that is where you have the most strength and control.",
      "Use the basic rhythm from lesson 16 with these chords.",
      "Hold the shape, take your hand away, put it back, then do something else and return. The shape goes into memory.",
    ],
    watch:
      "The finger and fret placements are the key part and are mixed up in what is spoken. Watch the shape being built and moved up the neck.",
    completeness: "partial",
  },
  {
    id: "jens-lesson-26-playing-position",
    instructor: "jens-kruger",
    title: "How to sit, hold and relax with the banjo",
    order: 26,
    video: {
      id: "YikyRc3Sbb4",
      title: "Jens Kruger - Beginner Banjo Lesson 26 / Playing Position",
    },
    topics: ["posture-position", "fretting-hand", "pick-hand", "gear-picks", "practice-approach"],
    foundations: [
      "The aim is to hold the banjo and sit so you do not get cramped.",
      "Jens practises with the banjo between his legs. On stage he uses a strap that only keeps the banjo in place, with little weight on it.",
      "Keep the arm relaxed and the wrist neither bent up nor down. A bent wrist limits grip and strength.",
      "A big chord stretch may push the wrist forward. That is fine for a short time, but not as a habit.",
      "Avoid gripping the neck in a way that stops your hand moving freely.",
      "Playing near the bridge gives a quiet sound. The right wrist has only a little angle, and the fingers are freer.",
    ],
    nuance: [
      "You may not manage two fingers down on the head. Allen Shelton used only the pinky, and J.D. Crowe's hand looked awkward but relaxed.",
      "The only right-hand position is the one where you are relaxed. Do not copy a position from the internet.",
      "Practise in the position you will perform in, including chair height, because a different chair feels awkward.",
      "Stay relaxed and let your shoulders fall. He prefers sitting because the banjo is heavy.",
    ],
    watch:
      "The hand positions and wrist angles are shown but only loosely described in words. Watch them to copy the posture.",
    completeness: "full",
  },
  {
    id: "jens-masterclass-101-slide-hammer-scale-melody",
    instructor: "jens-kruger",
    title: "Slides, hammer-ons and finding a tune on a scale",
    order: 101,
    video: {
      id: "3OcsC8gkF88",
      title: "Jens Kruger's Banjo Method for Beginners - An Easy and Joyful Way to Start Picking",
    },
    topics: ["slide", "hammer-pull", "roll-variation", "scales", "melody-on-roll"],
    foundations: [
      "You can hammer onto a note or slide into it, and you can slide up while your roll keeps going.",
      "The roll never stops. Whether you slide or hammer is up to you.",
      "Play a scale and learn how it sounds. The sound is worth more than memorizing the note names.",
      "Once the scale is in your ear, you can go looking for a melody on it. He uses Home Sweet Home as the first tune.",
    ],
    nuance: ["He says he is offering a possibly different way of approaching the banjo."],
    watch:
      "Nearly all of this is played, not spoken: the roll, the scale and how the tune is found. Watch to see which strings and fingers he uses.",
    completeness: "thin",
  },
  {
    id: "jens-masterclass-102-pick-shape-and-attack",
    instructor: "jens-kruger",
    title: "Finger picks: polish, shape and how they hit the string",
    order: 102,
    video: {
      id: "5bY_T-IYWYk",
      title: "Jens Kruger Banjo Masterclass - Pick Technique",
    },
    topics: ["gear-picks", "pick-hand", "posture-position", "practice-approach"],
    foundations: [
      "Any kind of finger pick will do. What matters is that the picks are polished smooth.",
      "A new set often has rough edges. A buffing wheel wears them in fast, but do not hold them on it long enough to get hot.",
      "Wear the picks a little angled so the front of the pick meets the string. Striking with the side gives a thin tone.",
      "Curve the pick around the finger. The string is then hit slightly downward, which gives a much fuller tone.",
      "Keep the hand relaxed. One finger resting on the head is enough to anchor it, as long as the hand is not crammed.",
    ],
    nuance: [
      "Long-time players have quite curved picks, because each new set gets bent to feel like the worn-out old one.",
      "He names Alan Shelton and Lynn Morris as players who never rest two fingers down.",
      "Hands differ from player to player, so do not study other hands too much. He mentions J.D. Crowe's as an example.",
      "He sums it up as: the tone is in the hands, in the way you attack the string.",
    ],
    watch:
      "Watch the angle of his hand and picks and the sound of a straight pick against a curved one. Those are shown and heard, not described.",
    completeness: "partial",
  },
  {
    id: "jens-masterclass-103-triplet-patterns",
    instructor: "jens-kruger",
    title: "Triplet roll patterns, shown one by one",
    order: 103,
    video: {
      id: "GJVEjOavv7w",
      title: "Jens Kruger Masterclass - Triplets",
    },
    topics: ["triplets", "roll-other", "melody-on-roll", "chords-basic"],
    foundations: [
      "He is asked how he plays little triplets, so he shows a few roll patterns made of three-note groups.",
      "The first two patterns differ in where the melody sits: on the second string for one, on the first string for the other.",
      "These patterns can be used over chords and have all kinds of uses.",
      "He plays each pattern right after naming it, so you hear the sound and the picking order together.",
    ],
    nuance: [
      "He offers them as a menu of useful patterns to try, not as rules.",
      "One of them is a pattern he says he sometimes likes to use.",
    ],
    watch:
      "The strings, fingers and order of each pattern are mixed up in his speech. Watch the picking hand, because the patterns can only be learned by seeing and hearing them.",
    completeness: "thin",
  },
  {
    id: "jens-masterclass-110-licks-as-small-blocks-moved-between-keys",
    instructor: "jens-kruger",
    title: "Licks from your tab as blocks you can move",
    order: 110,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 19,
    },
    topics: ["improvising", "keys-positions", "endings-licks", "tablature", "practice-approach"],
    foundations: [
      "This talk is for players who mostly read tab or know a few tunes and want to start making musical ideas of their own.",
      "Look at tab you already play in small pieces, one or two bars at a time. Each piece has its own musical character.",
      "Take a lick and move it up to another key. A lick that goes from G to C can become one that goes from A to D, then D to G.",
      "Two kinds of licks are needed. Standing licks stay on one chord. Moving licks lead from one chord to the next.",
      "Go through all the tab you know, pick out interesting licks, and try them on a barre chord or in other keys.",
    ],
    nuance: [
      "Don Reno and Eddie Adcock moved licks around all the time. He shows an Earl Scruggs lick in G, then in C.",
      "He calls one lick a standing lick: it stays on G for two bars. He used it everywhere as a young player, a lick he credits to John Hickman and Dixie Breakdown.",
      "This gets you going because you do not have to think about every note.",
    ],
    watch:
      "All the licks are played, not spoken, so the notes and positions are only in the video. Watch the Earl Scruggs lick moved from G to C.",
    completeness: "full",
  },
  {
    id: "jens-masterclass-111-prepared-licks-lego-blocks",
    instructor: "jens-kruger",
    title: "Prepared licks as building blocks",
    order: 111,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 540,
    },
    topics: ["improvising", "endings-licks", "keys-positions", "practice-approach"],
    foundations: [
      "One side of improvising is prepared material you know, perhaps eight or sixteen notes long, played without thinking about each note.",
      "While a prepared lick plays, your mind is free to look ahead and plan the next chord.",
      "Build a stock of small favorite licks for each chord, then convert them to other keys so they fit different chord progressions.",
      "Think of them as Lego blocks. Each one buys you time to decide on the next.",
    ],
    nuance: [
      "His reason: you can only make about three or four conscious decisions per second, and a fast tune moves much quicker than that.",
      "He promises a completely different way of improvising later in the talk.",
    ],
    watch: "He plays a nice backup lick as an example. The notes are only in the video.",
    completeness: "full",
  },
  {
    id: "jens-masterclass-112-short-fragments-over-chord-changes",
    instructor: "jens-kruger",
    title: "Short fragments, and arriving early on the next chord",
    order: 112,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 697,
    },
    topics: ["improvising", "chords-changes", "endings-licks", "keys-positions"],
    foundations: [
      "Invent short melodic fragments, put them in many keys, and string them together along a chord progression.",
      "The same lick shape works for G to C, A to D, C to F, D to G and E to A.",
      "Bring a lick in early, so that you land on the new chord exactly when it is due, not after it.",
      "You can play the lick for the chord before the one you are heading to, even if nobody in the band plays that chord. It adds tension and flavor.",
      "A long lick need not be played whole. Play only part of it. Mixing licks over the chords where they fit is, he says, the basis of improvising.",
    ],
    nuance: [
      "Eddie Adcock used long licks a lot, and Jens plays the first half of one as a demonstration.",
      "His example: from G towards E minor he often plays a B chord shape first.",
      "He repeats the point deliberately: nobody else needs to play the chord you borrow. Try the tension.",
    ],
    watch:
      "The fragments and the borrowed chords are only played. Watch the little tune he builds from G, C7 and D7 pieces.",
    completeness: "partial",
  },
  {
    id: "jens-masterclass-113-aim-for-target-notes-in-a-tune",
    instructor: "jens-kruger",
    title: "Improvising around a tune by aiming at its key notes",
    order: 113,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 1195,
    },
    topics: [
      "improvising",
      "melody-melodic-style",
      "keys-positions",
      "history-players",
      "practice-approach",
    ],
    foundations: [
      "A second skill is making your own version of a tune. Know the important notes you must land on and get the overall shape.",
      "If you know you must reach the four chord, how you get there is flexible. Salt Creek still sounds like Salt Creek.",
      "Think of the key notes as pillars of the melody. Improvise around them and find your own way between them.",
      "In a jam, work out where the important things happen and cover those. Catching every note at first is hard.",
      "On up-the-neck breaks, start the melody on a middle string so the top string and the fifth are free to keep rolling.",
    ],
    nuance: [
      "He compares it to a painter stepping back and squinting to see the shapes of a picture.",
      "A banjo that plays something slightly different from the fiddle sounds bigger, and it adds a percussive element.",
      "He tells of kids at Union Grove playing one tune together for twenty or thirty minutes, getting closer to it each time around.",
      "John Hickman's version of Forked Deer covers the idea of the tune without playing the exact melody.",
    ],
    watch:
      "The different ways he reaches the same target in Salt Creek are only played. Watch and listen to compare them.",
    completeness: "full",
  },
  {
    id: "jens-masterclass-114-sing-along-and-play-what-you-hear",
    instructor: "jens-kruger",
    title: "Singing along so you play what you hear",
    order: 114,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 1824,
    },
    topics: ["improvising", "singing-along", "scales", "keys-positions", "practice-approach"],
    foundations: [
      "Always sing along when you practice scales. Singing helps your mind remember where the notes are.",
      "Start very simply: play a rhythm on one note and sing it, then use two or three notes. Tap your foot for the rhythm.",
      "Do not judge how it sounds. Sing so there is a direct link between what you hear inside and the instrument.",
      "Pick one position, use only notes from it, and sing small phrases. Then link the little melodies together.",
      "You need not watch your hands. They find what you sing. In another position, the same relationships repeat around the home note.",
    ],
    nuance: [
      "The aim is to stop listening to what you play and play what you hear, like a conversation where you think of what to say and not the words.",
      "He finds watching his fingers distracting and never wears glasses on stage.",
      "Composed pieces are a different mindset. There he knows what he will play.",
    ],
    watch:
      "He plays the first few frets and then the same pattern higher up the neck. The exact notes and fingering are only shown on screen.",
    completeness: "partial",
  },
  {
    id: "jens-masterclass-115-three-skills-and-starting-a-solo",
    instructor: "jens-kruger",
    title: "Three improvising skills, and how to start a solo",
    order: 115,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 2247,
    },
    topics: ["improvising", "melody-melodic-style", "practice-approach", "rhythm-timing"],
    foundations: [
      "Skill one: prepared licks, where you can rest and think ahead. Skill two: know the points to reach and find a way there. Skill three: play what you hear.",
      "When you are tired or have no ideas, prepared licks get you through. Otherwise move on to playing what is on your mind.",
      "Do not plan your entry in detail while someone else solos. Under stress you will forget it. A good start is always the melody.",
      "Start simple. A big lick at the start makes it harder to find your way in.",
      "Listen to your first notes in the company of the others. What you just did gives you the next idea.",
    ],
    nuance: [
      "A common trap: he starts with a lick, it ends, and he has no more ideas because he was not inspired by his own playing.",
      "Solos do not always have to be fast.",
      "His brother says real improvising begins when you make a mistake in something prepared. When panic sets in, he stays simple.",
    ],
    watch:
      "He plays a simple entry over a slow fiddle-style backing. Watch how small the first phrase is.",
    completeness: "full",
  },
  {
    id: "jens-masterclass-116-recap-and-chords-between-chords",
    instructor: "jens-kruger",
    title: "Recap, and connecting chords between chords",
    order: 116,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 2694,
    },
    topics: ["improvising", "chords-changes", "keys-positions", "endings-licks"],
    foundations: [
      "Take licks and parts from tunes you know as building blocks, and use the same lick in different keys and different settings.",
      "Know the difference between a standing lick and a moving lick.",
      "Sing along in different positions. Once you understand how an anchor note relates to its position, you understand it in another key.",
      "A connecting chord can bridge two chords. Going from G to F sounded poorly joined, but a C7 on the way to F connects well.",
      "A dominant seventh chord works to any chord you want to go to. He also lists augmented and flat-nine chords.",
    ],
    nuance: [
      "The band need not play these chords. They are only there to move from one spot to another.",
      "His rule: there is no wrong in there. If you like it, it is right, and theory will explain it later.",
    ],
    watch:
      "The chord shapes he uses for the connecting chords are only shown, not named in enough detail to copy.",
    completeness: "partial",
  },
  {
    id: "jens-masterclass-117-questions-space-speed-and-mistakes",
    instructor: "jens-kruger",
    title: "Q and A: simple starts, space, speed and mistakes",
    order: 117,
    video: {
      id: "Jf6B6uHC7mk",
      title:
        "5 String Banjo Improvising Tips & Tricks | Deering Banjo Masterclass with Jens Kruger",
      startSeconds: 2965,
    },
    topics: ["improvising", "speed-clean", "rhythm-timing", "practice-approach", "history-players"],
    foundations: [
      "To think faster in real time, start simple so your musical mind has ideas. Over-planning a grand entry can get you lost.",
      "Prepared licks are the fastest route, since you can tie them together at almost any speed.",
      "A held note carries more weight. Make a note important by playing it louder, ornamenting it, or leaving space right after it.",
      "Constant playing tires the ear. Pauses give weight to what you just played, and a call and answer with a pause works well in blues.",
      "For speed, either play slow and clean with a metronome, or play as fast as you can even when it is messy. Try both and do not beat yourself up.",
    ],
    nuance: [
      "A fast lick was learned very slowly first. Repeating it is what makes it fast, and the hours count.",
      "He says real-time thinking gets stressful at high tempos. Around 115 to 120 he finds a great speed for jamming.",
      "He played very fast as a teenager by always playing above his ability, and compares it to a race-car driver at the limit.",
      "Guitar ideas carry over to the banjo, and playing other instruments broadens the musical mind.",
      "He is open about weak spots. He says he is poor at pauses and now builds them in on purpose.",
    ],
    watch:
      "The call-and-answer and pause examples are played. Watch them to hear how much space he leaves.",
    completeness: "full",
  },
  {
    id: "tony-01-essential-banjo-rolls",
    instructor: "tony-trischka",
    title: "The essential rolls as finger patterns",
    order: 1,
    video: {
      id: "BMboS567j_U",
      title: "Essential Banjo Rolls | Tony Trischka | ArtistWorks",
    },
    topics: [
      "roll-alternating-thumb",
      "roll-backward",
      "roll-osborne",
      "roll-forward",
      "roll-forward-backward",
    ],
    rolls: ["forward-reverse", "alternating-thumb", "backward", "middle-leading"],
    foundations: [
      "Think of a roll as a finger pattern, not a fixed set of strings. A forward roll is thumb, index, middle, wherever it is played.",
      'Forward roll examples: strings 5-2-1, 5-3-1, or the "inside" version on strings 4-3-2.',
      "Alternating thumb roll: thumb on string 3, index on 2, thumb on 5, middle on 1.",
      "Backward roll: middle on string 1, index on 2, thumb on 5.",
      "Osborne roll: middle on string 1, index on 2, middle on 1, thumb on 5.",
      "Forward-backward roll: forward on strings 3-2-1, thumb on 5 as the pivot, then back 1-2-3 with middle, index, thumb. The eighth note goes on string 1.",
    ],
    nuance: [
      "The alternating thumb roll can also start on string 4 instead of 3.",
      "In Cripple Creek the alternating thumb roll opens with a slide. Let go with the middle finger while you slide, or the held 3rd fret clashes.",
      'Earl stacked backward rolls and mixed them with forward rolls, which feels more syncopated than a plain "da-pa".',
      "He did not hear Earl use the Osborne roll. Sonny Osborne found it in Old Joe Clark, and it suits a melody on string 1.",
      "The forward-backward roll almost always finishes on string 1. Boil Them Cabbage Down uses it over C and D7.",
    ],
    watch:
      "Every roll is played for you, so watch the right hand to hear the rhythm. How an eight-note forward roll ends is not spoken.",
    completeness: "full",
  },
  {
    id: "tony-02-melodic-style-intro",
    instructor: "tony-trischka",
    title: "Melodic style: scale-based playing",
    order: 2,
    video: {
      id: "OMXyBujxs2w",
      title: "Banjo Tips from Tony Trischka: Melodic Style Playing",
    },
    topics: [
      "melody-melodic-style",
      "scales",
      "fretting-hand",
      "melody-on-roll",
      "practice-approach",
    ],
    foundations: [
      "Scruggs style is built on chords: chord notes in repeating rolls, with the 2-3 slide. Melodic style is built on scales.",
      "In melodic style you often move to a lower string to reach a higher note. That avoids hitting one string again and again, and sounds smoother and rounder.",
      "His G scale: open 3rd string; 7th fret of string 4 with the pinky; open 2nd; 5th fret of string 3 with the middle finger.",
      "The scale goes on: open string 1; 5th fret of string 2 with the middle; 4th fret of string 1 with the index; open string 5. Then play it back down.",
    ],
    nuance: [
      "Many tunes use the whole scale or part of a scale pattern.",
      "He suggests starting melodic style early, alongside Scruggs style, even as a beginner.",
      "Boil Them Cabbage Down is his example of the chord-based sound, with G chord notes and then a C arpeggio.",
    ],
    watch:
      "The tune he plays and the fingers he does not name are only shown. Watch the fretting hand through the scale and the picking hand on the way back down.",
    completeness: "partial",
  },
  {
    id: "tony-03-melodic-scale-patterns",
    instructor: "tony-trischka",
    title: "Scale patterns and inside rolls",
    order: 3,
    video: {
      id: "LRij0gBLmAs",
      title: "Banjo Lesson: Melodic Scale Patterns with Tony Trischka || ArtistWorks",
    },
    topics: [
      "melody-melodic-style",
      "scales",
      "roll-forward",
      "roll-backward",
      "practice-approach",
      "improvising",
    ],
    foundations: [
      "Inside forward roll: strings 4-3-2 with thumb, index, middle. Inside backward roll: strings 2-3-4. Inside means the middle finger plays string 2, not string 1.",
      "Practise the inside rolls with a metronome until the middle finger on string 2 feels natural.",
      "A scale pattern turns a straight scale into groups: scale notes 1-2-3-1, then 2-3-4-2, then 3-4-5-3, and so on up.",
      "A second pattern runs 1-3-2-1, then 2-4-3-2, then 3-5-4-3. On string 3 alone the frets are 0-4-2-0, 2-5-4-2, 4-7-5-4, 5-9-7-5.",
    ],
    nuance: [
      "Lift the fingers between notes for clear, separate sound, except at high speed. Some notes are better held together, so not every one.",
      "Keep the timing tight with a metronome.",
      "Use a small piece of a pattern as an intro, or as a lick when going from G to C.",
      "You do not need all four measures in a tune such as Blackberry Blossom. Take the first two, the last two or a middle piece and experiment.",
      "The same pitch can sit in two places on the neck, for example the 4th fret of string 1 and the 5th fret of string 2.",
    ],
    watch:
      "He plays each phrase and says the fingerings quickly, so check the exact frets and fingers against his written lesson. The licks that start with a Scruggs-style hammer are only played.",
    completeness: "partial",
  },
  {
    id: "tony-04-blackberry-blossom-opening",
    instructor: "tony-trischka",
    title: "Blackberry Blossom opening phrase",
    order: 4,
    video: {
      id: "JWjnJp5eKoc",
      title: 'Banjo Tips from Tony Trischka: "Blackberry Blossom"',
    },
    topics: ["melody-melodic-style", "chords-barre", "slide", "roll-forward"],
    foundations: [
      "The opening of Blackberry Blossom is basically a scale pattern.",
      "It starts with the middle finger on the 10th fret of string 2 and the index on the 9th fret of string 1, then a forward roll that ends with the thumb on string 5.",
      "Next slide the middle finger from the 10th fret down to the 7th fret on string 2, and add the ring finger on the 7th fret of string 1.",
    ],
    nuance: ["He plays only the first part of the tune, because it is fun."],
    watch:
      "The whole phrase is played, not described. The notes after the slide, the rhythm and the tempo are only shown, so watch it with a tab beside you.",
    completeness: "partial",
  },
  {
    id: "tony-05-speed-one-measure",
    instructor: "tony-trischka",
    title: "Building speed with one measure",
    order: 5,
    video: {
      id: "tBXHlyrALoA",
      title: "Speed Up Your Banjo Skills With This Trick! (Ft. Tony Trischka) || ArtistWorks",
    },
    topics: ["speed-clean", "practice-approach"],
    foundations: [
      "To get faster, do not play a whole tune fast. Play one measure of it, or just a few rolls, at speed.",
      "Most people can move their fingers quickly in a short burst, while a whole tune at speed is daunting.",
    ],
    nuance: [],
    watch:
      "A very short clip: one practice idea, with no exercise or tune to follow. You can try it with any measure you already know.",
    completeness: "thin",
  },
  {
    id: "tony-06-foggy-mountain-roll",
    instructor: "tony-trischka",
    title: "The Foggy Mountain roll and why the thumb",
    order: 6,
    video: {
      id: "AvKQNjGJzWc",
      title: "Banjo Tips from Tony Trischka: Foggy Mountain Breakdown Roll",
    },
    topics: ["roll-foggy-mountain", "hammer-pull", "pick-hand"],
    rolls: ["foggy-mountain"],
    foundations: [
      "His example is Train 45, which begins with the same lick as Foggy Mountain Breakdown: a double hammer-on from 2 to 3 on string 2, then open string 1.",
      "Instead of index, middle twice, Earl played index on string 2, middle on string 1, thumb on string 2, then middle on string 1 again.",
      "In Train 45 keep the fretting-hand middle finger down on the 3rd fret of string 2 after the hammer-on.",
    ],
    nuance: [
      "Why the thumb: gravity helps it, index and middle twice in a row feels weak at fast tempos, and the thumb sits further from the bridge so the tone is a little different.",
      "Asked why, Earl said it felt better. Tony says Earl could hear the difference between index and thumb at speed.",
      "He says the trick took him about seven years to learn.",
    ],
    watch:
      "Only the first four notes of the roll are spoken. The rest of it, and how it sounds against the plain index-middle version, you have to watch and hear.",
    completeness: "partial",
  },
  {
    id: "tony-07-diatonic-chords",
    instructor: "tony-trischka",
    title: "Building chords from the G scale",
    order: 7,
    video: {
      id: "iNWQ2iGnwyc",
      title: "Bluegrass Banjo Lesson: Crafting Diatonic Chords with Tony Trischka || ArtistWorks",
    },
    topics: ["chords-diatonic", "chords-barre", "scales", "keys-positions", "history-players"],
    foundations: [
      "Diatonic chords come from a scale. Take every other note of the G scale, starting on each note in turn.",
      "The order in G: G major 7, A minor 7, B minor 7, C major 7, D7, E minor 7, F sharp half-diminished, then G major 7 again an octave up.",
      "In G major 7 the added note is the major seventh, not the flat seventh.",
      'A minor 7 and B minor 7 use the same shape moved up two frets. A is the G "F position" shape two frets higher with the third flattened.',
    ],
    nuance: [
      "Thirds, fourths and sixths are all derived from these chords.",
      "He credits Bill Keith with bringing this idea to the banjo.",
      "When barring, put the middle finger on top of the index for extra pressure.",
    ],
    watch:
      "Every chord shape is played up the neck, and the fret numbers go by fast. Watch for the exact fingering of each chord, as it is not all spoken clearly.",
    completeness: "partial",
  },
  {
    id: "tony-08-earl-slide-to-melody",
    instructor: "tony-trischka",
    title: "Earl's slide into a melody note",
    order: 8,
    video: {
      id: "Jk1WlqgfOCQ",
      title: "How to play banjo like Earl Scruggs by Tony Trischka",
    },
    topics: ["slide", "roll-forward", "melody-on-roll"],
    foundations: [
      "Earl, and others before him, often slid into a melody note rather than hitting it straight.",
      "To reach a note on string 3, slide from the 2nd to the 5th fret on string 4.",
      "To reach a melody note on open string 2, slide into it in the same way.",
    ],
    nuance: ["The slide may be followed by a forward roll."],
    watch:
      "A very short clip, mostly played. The sound, the rhythm and exactly how the slide leads into the roll are only shown.",
    completeness: "thin",
  },
  {
    id: "tony-09-basic-chords",
    instructor: "tony-trischka",
    title: "G, C and D7 with one roll",
    order: 9,
    video: {
      id: "H2EnuR2k7Ho",
      title: "Banjo Tips from Tony Trischka: Basic Banjo Chords",
    },
    topics: ["chords-basic", "roll-alternating-thumb", "practice-approach"],
    rolls: ["alternating-thumb"],
    foundations: [
      "G is the open strings in standard G tuning. Strum it.",
      "C: ring finger on the 2nd fret of string 1 and index on the 1st fret of string 2. The full C adds the middle finger on the 2nd fret of string 4. String 3 stays open.",
      "D7: from the C shape keep the index on the 1st fret of string 2, lift the others and put the middle finger on the 2nd fret of string 3.",
      "G, C and D7 are enough for This Land Is Your Land and many folk and bluegrass songs.",
      "Alternating thumb roll: thumb, index, thumb, middle on strings 3-2-5-1. The exact strings matter less than the finger order.",
      "Play one roll over each chord: G, then C (3-2-5-1, then 4-2-5-1), then D7, then back to G.",
    ],
    nuance: [
      "The roll can start on string 4 as well: 4-2-5-1.",
      "If the full C is hard, play only the index and ring fingers and add the middle finger halfway through.",
    ],
    watch:
      "He goes slowly, naming fingers and strings twice. The tempo of the roll and how the chord changes land on the beat are only shown.",
    completeness: "full",
  },
  {
    id: "tony-10-blackberry-blossom-barre",
    instructor: "tony-trischka",
    title: "Blackberry Blossom with barre chords",
    order: 10,
    video: {
      id: "XnCGYkN_sAU",
      title:
        'Beginner Banjo Lesson: Learn to Play "Blackberry Blossom" Using Barre Positions with Tony Trischka',
    },
    topics: ["chords-barre", "fretting-hand", "chords-changes"],
    foundations: [
      "This is a chord-based version of the tune. The full melodic-style version is harder.",
      "For the C barre, lay the index across the first four strings at the 5th fret and press hard to avoid buzz. Put the middle finger on top of the index to help.",
      "Open G is a barre position too, with the nut doing the barring.",
      'The G "F position" up the neck: pinky 5th fret of string 1, index 3rd fret of string 2, middle 4th fret of string 3, ring 5th fret of string 4. Play just the top three strings.',
      "Other chords he uses: a D shape around the 7th to 9th frets, a barred D at the 7th fret, A at the 2nd fret, and D near the nut.",
    ],
    nuance: ["A low open D string at the bottom helps define the D chord."],
    watch:
      "The tune itself, the order of the chords and the picking pattern are not spoken. Watch his barre and how the hand moves between positions.",
    completeness: "partial",
  },
  {
    id: "tony-11-scruggs-ending",
    instructor: "tony-trischka",
    title: "A high Earl Scruggs ending",
    order: 11,
    video: {
      id: "IwWzlecgMWs",
      title: "Tips from the Masters: Earl Scruggs Ending with Tony Trischka || ArtistWorks",
    },
    topics: ["endings-licks", "pick-hand", "fretting-hand"],
    foundations: [
      "The ending jumps up to the 12th fret of string 1.",
      "The notes in order: middle finger on the 12th fret of string 1, pinky on the 14th, pinky on the 17th, then the last two notes 19 to 17, played without alternating.",
    ],
    nuance: [
      "Tony believes Earl damps the 5th string with the palm, away from the bridge. He says this is his own reading of Earl.",
    ],
    watch:
      "The whole ending is played, and the tune is not named. The alternating pattern in the first notes and the sound of it are only shown.",
    completeness: "thin",
  },
  {
    id: "tony-12-e-lick",
    instructor: "tony-trischka",
    title: "A Bill Keith lick ending on E",
    order: 12,
    video: {
      id: "E6mQj0DivYo",
      title: 'Tips from the Masters: "E Lick" with Tony Trischka || ArtistWorks',
    },
    topics: ["endings-licks", "roll-backward", "chords-barre"],
    foundations: [
      "This is a lick from Bill Keith. Pinky, ring and middle finger sit around the 9th fret of the first three strings, with no barre.",
      "Play backward rolls on strings 1-2-3, then lift the pinky and then the ring finger.",
    ],
    nuance: ["Tony calls Bill Keith one of his banjo heroes."],
    watch:
      "Spoken very quickly and mostly played. The low part of the lick and the E at the end are not clear, so this one needs the video or a written tab.",
    completeness: "thin",
  },
  {
    id: "tony-13-travis-picking",
    instructor: "tony-trischka",
    title: "Travis picking: the alternating thumb",
    order: 13,
    video: {
      id: "mtq7zcZLvb8",
      title: "Tips from the Masters: Travis Picking with Tony Trischka || ArtistWorks",
    },
    topics: ["travis-picking", "history-players"],
    foundations: ["In Travis picking the thumb alternates back and forth all the way through."],
    nuance: [
      "The style comes from Mississippi Delta blues players such as Robert Johnson and Skip James, and from Merle Travis.",
      "He calls the back-and-forth thumb a really fun thing to do on the banjo.",
    ],
    watch:
      "Nearly all of it is played. He plays it slowly and asks you to watch the thumb. Which strings the thumb uses is not said.",
    completeness: "thin",
  },
  {
    id: "tony-14-four-note-pattern",
    instructor: "tony-trischka",
    title: "A four-note pattern to move around",
    order: 14,
    video: {
      id: "Tnj8HzM-uwE",
      title: "Tips from the Masters: 4 Note Pattern with Tony Trischka || ArtistWorks",
    },
    topics: ["roll-variation", "roll-forward", "improvising", "speed-clean", "chords-changes"],
    foundations: [
      "The pattern is four notes: index on string 1, then a forward roll on strings 3-2-1 with thumb, index, middle.",
      'Keep repeating it and move the chord shapes under it, for example the G "F position" up three frets, then on up and back down.',
    ],
    nuance: [
      "Starting with the index and ending with the middle means no picking finger repeats.",
      "It is good for building speed and for improvising, and he says he uses it a lot himself.",
    ],
    watch:
      "The chord shapes beyond their names, the path of the shapes up the neck and the tempo are only played. Watch the fretting hand as it moves.",
    completeness: "partial",
  },
  {
    id: "tony-15-sixths",
    instructor: "tony-trischka",
    title: "Sixths up the neck in G",
    order: 15,
    video: {
      id: "NdQyjrwdP-s",
      title: "Tips from the Masters: Sixths on the Banjo with Tony Trischka || ArtistWorks",
    },
    topics: ["sixths", "melody-melodic-style", "improvising", "keys-positions"],
    foundations: [
      "Sixths are a way to bring out a melody and to improvise.",
      "In G they sit on strings 3 and 1. Fret pairs include 2 and 4, 4 and 5, 5 and 7, 7 and 9, 9 and 10, then 11 and 12, 12 and 14, 14 and 16, 16 and 17.",
    ],
    nuance: ["His advice is to start experimenting with these positions."],
    watch:
      "A short clip with the fretting and the picking-hand technique only shown. Check the first pair of frets, as it was hard to hear.",
    completeness: "thin",
  },
];
