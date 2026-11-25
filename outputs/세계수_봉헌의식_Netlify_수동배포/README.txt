세계수 봉헌의식 · Netlify 배포 파일

Netlify에서 Add new site → Deploy manually를 선택한 뒤 이 폴더를 업로드하면 됩니다.
index.html이 폴더 최상단에 있으며 Three.js, 이미지, GLB 파일이 모두 포함되어 있습니다.

로컬 미리보기는 Python 3에서 이 폴더를 기준으로 다음 명령을 실행하면 됩니다:
python3 -m http.server 4173 --bind 127.0.0.1
