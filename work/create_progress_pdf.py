from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer


ROOT = Path('/Users/ahbbang/Documents/Codex/2026-11-10/new-chat')
OUTPUT = ROOT / 'outputs' / '세계수_봉헌의식_웹사이트_제작_진행상황.pdf'

regular = '/Library/Fonts/NanumSquareNeo-bRg.ttf'
bold = '/Library/Fonts/NanumSquareNeo-cBd.ttf'
if not Path(regular).exists():
    regular = '/Library/Fonts/BookkGothic_Light.ttf'
if not Path(bold).exists():
    bold = '/Library/Fonts/BookkGothic_Bold.ttf'

pdfmetrics.registerFont(TTFont('Korean', regular))
pdfmetrics.registerFont(TTFont('KoreanBold', bold))

PAGE_W, PAGE_H = A4
MARGIN_X = 25 * mm
MARGIN_TOP = 21 * mm
MARGIN_BOTTOM = 20 * mm


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(HexColor('#D9D9D2'))
    canvas.setLineWidth(0.45)
    canvas.line(MARGIN_X, 16 * mm, PAGE_W - MARGIN_X, 16 * mm)
    canvas.setFont('Korean', 8)
    canvas.setFillColor(HexColor('#77776F'))
    canvas.drawString(MARGIN_X, 10.5 * mm, '세계수 봉헌의식 웹사이트 제작 진행상황')
    canvas.drawRightString(PAGE_W - MARGIN_X, 10.5 * mm, str(doc.page))
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=MARGIN_X,
    rightMargin=MARGIN_X,
    topMargin=MARGIN_TOP,
    bottomMargin=MARGIN_BOTTOM,
    title='세계수 봉헌의식 웹사이트 제작 진행상황',
    author='웹사이트 제작 진행 보고',
)
frame = Frame(
    MARGIN_X,
    MARGIN_BOTTOM,
    PAGE_W - 2 * MARGIN_X,
    PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
    id='body',
    leftPadding=0,
    rightPadding=0,
    topPadding=0,
    bottomPadding=0,
)
doc.addPageTemplates(PageTemplate(id='report', frames=[frame], onPage=draw_page))

styles = getSampleStyleSheet()
title = ParagraphStyle(
    'TitleKorean',
    parent=styles['Title'],
    fontName='KoreanBold',
    fontSize=23,
    leading=32,
    alignment=TA_CENTER,
    textColor=HexColor('#20251E'),
    spaceAfter=8 * mm,
)
subtitle = ParagraphStyle(
    'SubtitleKorean',
    parent=styles['Normal'],
    fontName='Korean',
    fontSize=9.5,
    leading=15,
    alignment=TA_CENTER,
    textColor=HexColor('#77776F'),
    spaceAfter=10 * mm,
)
heading = ParagraphStyle(
    'HeadingKorean',
    parent=styles['Heading2'],
    fontName='KoreanBold',
    fontSize=13.5,
    leading=20,
    textColor=HexColor('#34412F'),
    spaceBefore=4.5 * mm,
    spaceAfter=2 * mm,
    keepWithNext=True,
)
body = ParagraphStyle(
    'BodyKorean',
    parent=styles['BodyText'],
    fontName='Korean',
    fontSize=9.8,
    leading=17.2,
    textColor=HexColor('#2D302B'),
    wordWrap='CJK',
    spaceAfter=2.8 * mm,
)

sections = [
    (
        '1. 프로젝트 개요',
        '반인반식이 살아가는 세계에서 한 사람의 삶에 축적된 동작을 식물장식으로 기록하고, 사후에 그 장식을 세계수에 봉헌하는 과정을 체험하는 3D 웹사이트를 제작했습니다. 방문자가 인물을 선택하고 삶의 기록을 읽은 뒤 장식을 직접 봉헌했으며, 봉헌 이후에는 장식의 시점으로 세계수 내부를 이동해 에너지 전환과 환생을 경험하도록 구성했습니다.'
    ),
    (
        '2. 인물과 생애 생성',
        '방문자가 직접 인생을 설정하는 방식 대신 이름, 구역, 직업, 향년, 성별을 가진 여러 인물을 무작위로 제시하도록 구현했습니다. 인물마다 어린 시절, 직업 활동, 전환점, 말년의 사건이 서로 다르게 조합되도록 생애 문장 구조를 확장했습니다. 생애에 가족, 스승, 동료 등의 이름을 포함했으며, 이름을 클릭하면 해당 인물의 삶을 다시 생성해 확인할 수 있도록 연결했습니다. 여성, 남성, 논바이너리 인물의 성별에 따라 언니, 오빠, 누나, 형, 손위 자매, 손위 형제 호칭이 맞게 나타나도록 수정했습니다.'
    ),
    (
        '3. 삶의 동작과 식물장식',
        '삶의 기록을 감싸다, 내밀다, 버티다, 받아들이다, 뻗다, 쌓다의 여섯 동작으로 구분했습니다. 감싸다는 관계와 유대, 내밀다는 도움과 배려와 희생, 버티다는 인내와 고통 감수, 받아들이다는 배움과 이해와 수용, 뻗다는 도전과 욕망, 쌓다는 꾸준함과 반복을 반영하도록 계산했습니다. 특히 봉사하거나 다른 사람을 돕고 배려한 생애에서는 내밀다 수치가 높게 계산되도록 보정했습니다.'
    ),
    (
        '4. 장식의 성장 표현',
        '각 동작의 누적량을 0.0단계부터 3.0단계까지 0.1단위로 표현하도록 구현했습니다. 완성된 반복 요소만 보여주는 방식에서 벗어나 2.5단계처럼 다음 요소가 절반까지 자란 모습도 표현했습니다. 높은 단계에서는 최종 장식 이미지를 기준으로 부족한 부분만 흐리거나 감춰 성장 도중의 형태가 유지되도록 구성했습니다. 사용자가 제공한 광택 있는 질감의 장식 이미지를 각 위치와 성장 방향에 맞춰 배치했으며, 불필요한 단면이 보이지 않도록 고정된 3D 장식처럼 보이게 조정했습니다.'
    ),
    (
        '5. 봉헌 의식의 상호작용',
        '봉헌 과정은 장식 집기, 제단에 놓기, 봉헌하기의 세 단계로 구성했습니다. 사용자가 제공한 제단 단상 GLB 파일을 활용했으며, 장식이 제단 위로 자연스럽게 떠올라 원형으로 움푹 파인 홈에 놓이도록 연출했습니다. 장식을 기존보다 크게 보여주고, 안착 과정에서는 제단 위에서 장식을 내려다보는 시점으로 전환했습니다. 방문자가 관리자 이름을 입력하면 봉헌자 항목에 관리자와 입력한 이름이 저장되도록 구현했습니다. 제단과 장식의 로딩이 끝나기 전에는 다음 단계로 넘어갈 수 없도록 입력 상태도 보완했습니다.'
    ),
    (
        '6. 3D 공간과 자동 이동',
        '봉헌이 완료되면 사용자가 제공한 GLB 공간을 순서대로 불러와 하강 터널, 에너지 핵, 상승 터널, 세계수 외부, 환생으로 이어지는 자동 이동을 구현했습니다. 이동 중에는 마우스 드래그와 방향키로 시선을 자유롭게 조작할 수 있도록 했습니다. GLB의 모서리와 끊긴 부분이 화면에 드러나는 문제를 줄이기 위해 카메라 프레이밍, 안개, 배경 이미지, 가장자리 투명 처리를 조정했습니다. 장면 전환에는 페이드 인과 페이드 아웃을 사용했으며, 전체 이동 속도를 초기보다 빠르게 조정했습니다.'
    ),
    (
        '7. 핵과 상승터널 연출',
        '에너지 핵은 측면이 아닌 정면에서 전체 구조가 보이도록 카메라 위치를 수정했으며, 과도한 클로즈업을 줄였습니다. 장식에서 빠져나온 빛이 하강 터널을 따라 이동한 뒤 핵에 흡수되는 흐름을 입자로 표현했습니다. 상승터널에서는 단순히 정면으로 확대하지 않고 카메라의 높이와 시선을 함께 올려 상단의 빛이 들어오는 출구를 향해 이동하도록 수정했습니다. 출구에 가까워질 때 모델 상단이 과도하게 흐려지는 현상도 보정했습니다.'
    ),
    (
        '8. 환생과 봉헌 기록',
        '세계수 밖으로 나온 뒤 씨앗 껍질이 열리는 환생 장면을 구현했습니다. 종료 문구에는 선택한 인물의 장식이 봉헌된 뒤 새로운 씨앗으로 환생했으며 일정 시간이 지나면 분화한다는 내용을 표시했습니다. 봉헌 기록 페이지를 별도로 제작해 봉헌한 인물의 이름, 생애, 여섯 동작의 수치, 식물장식, 봉헌일, 봉헌자 이름을 다시 확인할 수 있도록 했습니다. 기록은 브라우저에 저장되며 같은 인물을 중복으로 기록하지 않도록 처리했습니다.'
    ),
    (
        '9. 화면 구성과 사용성 개선',
        '전체 화면은 어두운 녹색과 유기적인 세계수 이미지를 중심으로 구성했으며, 장식과 공간이 화면의 중심이 되도록 안내 문구와 버튼을 정리했습니다. 자동 이동 중 설명은 일정 시간이 지나면 접히고 필요할 때 다시 펼칠 수 있도록 했습니다. 하강, 핵, 상승, 환생의 현재 단계와 전체 진행도를 표시했습니다. 일시정지, 정면 보기, 움직임 완화, 환경음 설정을 제공했으며, 키보드 접근과 모바일 화면에서도 사용할 수 있도록 반응형 구성을 점검했습니다.'
    ),
    (
        '10. 현재 진행상황과 향후 계획',
        '현재 인물 생성, 생애 설명, 장식 계산과 성장, 제단 봉헌, 3D 자동 이동, 에너지 핵 흡수, 상승터널, 환생, 봉헌 기록까지 전체 체험 흐름을 구현했습니다. 주요 기능과 성장 계산을 자동 테스트했으며, 데스크톱과 모바일 화면에서 조작 상태를 확인했습니다. 다음 작업에서는 하강의 바람 소리, 핵의 낮은 공명, 출구의 외부 소리처럼 장면별 환경음을 세분화하고, GLB 사이의 전환을 위한 짧은 연결 통로 모델을 추가해 공간의 연속성을 높이기로 계획했습니다.'
    ),
]

story = [
    Paragraph('세계수 봉헌의식 3D 웹사이트<br/>제작 진행상황', title),
    Paragraph('그래픽디자인2 기말 프로젝트 · 2026년 11월 11일', subtitle),
]
for section_title, text in sections:
    story.append(Paragraph(section_title, heading))
    story.append(Paragraph(text, body))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc.build(story)
print(OUTPUT)
