.PHONY: build chat eval test check verify smoke-production

build:
	npm run build

chat:
	npm run chat

eval:
	npm run eval

test:
	npm test

check:
	npm run check

verify:
	npm run verify

smoke-production:
	npm run smoke:production
