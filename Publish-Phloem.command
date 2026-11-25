#!/bin/zsh
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

repo=oddugi02/dedication-to-the-worldtree
site="${0:A:h}/project-web"
[[ -f "$site/index.html" ]]
[[ "$(gh api user --jq .login)" == oddugi02 ]]
settings=$(gh api "repos/$repo/pages" --jq '[.build_type, .source.branch, .source.path] | join(" ")')
if [[ "$settings" != "legacy main /" && "$settings" != "legacy gh-pages /" ]]; then
  print -u2 "GitHub Pages 설정을 확인해 주세요: $settings"
  exit 1
fi

staging=$(mktemp -d)
print "배포 작업 폴더: $staging"
git -C "$staging" init -q -b gh-pages
git -C "$staging" remote add origin "https://github.com/$repo.git"
remote_branch=$(git -C "$staging" ls-remote --heads origin refs/heads/gh-pages)
if [[ -n "$remote_branch" ]]; then
  git -C "$staging" fetch --depth=1 origin gh-pages
  git -C "$staging" checkout -q -B gh-pages FETCH_HEAD
fi

cp "$site/index.html" "$staging/index.html"
for folder in src vendor public; do
  mkdir -p "$staging/$folder"
  rsync -a --exclude='.DS_Store' --exclude='.git' "$site/$folder/" "$staging/$folder/"
done
touch "$staging/.nojekyll"
git -C "$staging" add -- index.html .nojekyll src vendor public
if ! git -C "$staging" diff --cached --quiet; then
  git -C "$staging" -c user.name=oddugi02 -c user.email=235227182+oddugi02@users.noreply.github.com commit -qm 'Publish Phloem site'
fi
git -C "$staging" -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin gh-pages
if [[ "$settings" != "legacy gh-pages /" ]]; then
  gh api --method PUT "repos/$repo/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/'
fi
print '배포 요청 완료. GitHub Pages에서 배포가 끝나면 아래 주소가 열립니다.'
gh api "repos/$repo/pages" --jq .html_url
