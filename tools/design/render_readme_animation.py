#!/usr/bin/env python3
"""Render the README concept animation. Requires Pillow==13.0.0.

Run from any directory. Font defaults to DejaVu Sans; override with --font-dir.
The animation is explanatory artwork, not device telemetry or measured timing.
"""
import argparse
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BG = '#0b1521'
MINT = '#64edc9'
WHITE = '#edf7fa'
MUTED = '#9cb3c4'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir', type=Path, default=Path('/usr/share/fonts/truetype/dejavu'))
    args = parser.parse_args()
    fonts = {}

    def font(size, bold=False):
        key = (size, bold)
        if key not in fonts:
            name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
            fonts[key] = ImageFont.truetype(str(args.font_dir / name), size * 2)
        return fonts[key]

    frames = []
    for i in range(96):
        im = Image.new('RGB', (1920, 960), BG)
        d = ImageDraw.Draw(im)

        def line(points, fill, width=1):
            d.line([(int(x*2), int(y*2)) for x,y in points], fill=fill, width=width*2)

        def box(bounds, fill, outline=None, radius=12):
            d.rounded_rectangle(tuple(int(v*2) for v in bounds), radius=radius*2, fill=fill, outline=outline, width=2)

        def text(x,y,value,size,color=WHITE,bold=False,anchor=None):
            d.text((x*2,y*2), value, font=font(size,bold), fill=color, anchor=anchor)

        for x in range(0,960,40): line([(x,0),(x,480)], '#102230')
        for y in range(0,480,40): line([(0,y),(960,y)], '#102230')
        # Brand / shield
        line([(38,39),(50,35),(62,39),(62,54),(50,66),(38,54),(38,39)], MINT, 2)
        line([(44,49),(49,54),(57,44)],MINT,2)
        text(74,34,'SafeMeter',25,bold=True)
        box((740,34,920,60),'#14352f',radius=13)
        text(830,47,'CONCEPT ANIMATION',10,MINT,anchor='mm')
        text(38,100,'VEHICLE-POWERED. HUMAN-CENTERED.',10,MINT,bold=True)
        text(35,137,'When you can’t call,',36,bold=True)
        text(35,186,'your vehicle can.',36,MINT,bold=True)
        text(38,252,'A smarter speedometer.',18,MUTED)
        text(38,281,'A signal for help.',18,MUTED)
        text(38,331,'NO RIDER PHONE REQUIRED FOR SMS',10,MINT,bold=True)
        text(38,353,'Cellular coverage and device power required.',10,MUTED)

        if i < 32:
            phase=0; status='MONITORING'; color=MINT
            speed=round(46+3*math.sin(i/9)); label='KM/H'; number=str(speed)
            note='Speed + impact + orientation'
        elif i < 48:
            phase=1; status='CHECKING'; color='#ffca7b'
            number='03'; label='SENSOR GATES'; note='Impact / speed collapse / tilt'
        elif i < 72:
            phase=2; status='CANCEL WINDOW'; color='#ffca7b'
            number=f'{max(1,15-int((i-48)*15/24)):02}'; label='SECONDS'; note='Press cancel to stop escalation'
        else:
            phase=3; status='SMS QUEUED'; color=MINT
            number='SOS'; label='TO PRESET CONTACTS'; note='Delivery depends on the network'
        # Instrument cluster with arc and subtle moving sweep.
        cx,cy=745,223
        for radius in (118,130):
            d.ellipse(((cx-radius)*2,(cy-radius)*2,(cx+radius)*2,(cy+radius)*2),outline='#25404c',width=2)
        for tick in range(49):
            angle=math.radians(140+tick*260/48)
            r=120; r2=112 if tick%4==0 else 116
            line([(cx+math.cos(angle)*r,cy+math.sin(angle)*r),(cx+math.cos(angle)*r2,cy+math.sin(angle)*r2)],'#527283',1)
        d.arc(((cx-103)*2,(cy-103)*2,(cx+103)*2,(cy+103)*2),140,400,fill='#203b47',width=12)
        progress=(.72+.05*math.sin(i/8)) if phase==0 else ((i-32)/16 if phase==1 else ((72-i)/24 if phase==2 else 1))
        d.arc(((cx-103)*2,(cy-103)*2,(cx+103)*2,(cy+103)*2),140,140+max(.01,progress)*260,fill=color,width=12)
        text(cx,167,'SAFEMETER',10,MUTED,anchor='mm')
        text(cx,223,number,54,color,bold=True,anchor='mm')
        text(cx,267,label,9,MUTED,anchor='mm')
        box((cx-76,291,cx+76,316),'#17313b',radius=12)
        text(cx,303,status,9,color,bold=True,anchor='mm')
        text(cx,372,note,10,MUTED,anchor='mm')
        # Discrete sequence — no flashing or aggressive motion.
        line([(62,414),(900,414)],'#28414e',2)
        for index,(x,title) in enumerate([(62,'SENSE'),(340,'DECIDE'),(618,'CANCEL'),(896,'ALERT')]):
            active=index<=phase
            d.ellipse(((x-5)*2,409*2,(x+5)*2,419*2),fill=color if index==phase else (MINT if active else '#28414e'))
            text(x,436,title,9,WHITE if active else MUTED,anchor='mm')
        text(38,464,'SEVA / SURAKSHIT BHARAT / TRACK A',8,MUTED)
        text(920,464,'ILLUSTRATIVE FLOW · TIMING COMPRESSED · NOT LIVE TELEMETRY',8,MUTED,anchor='ra')
        frames.append(im.resize((960,480),Image.Resampling.LANCZOS))

    output=ROOT/'docs/assets'
    # One shared palette avoids frame-to-frame colour shimmer.
    palette_source = Image.new('RGB', (960, 480 * 4))
    for row, index in enumerate((0, 40, 60, 85)):
        palette_source.paste(frames[index], (0, 480 * row))
    palette=palette_source.quantize(colors=128)
    indexed=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in frames]
    indexed[0].save(output/'safemeter-animated.gif',save_all=True,append_images=indexed[1:],duration=125,loop=0,optimize=True,disposal=1)
    frames[0].save(output/'safemeter-static.png',optimize=True)
    print(f'Wrote {output / "safemeter-animated.gif"}')


if __name__ == '__main__':
    main()
