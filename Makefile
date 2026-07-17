.PHONY: build chat diagnostic eval test check smoke-production

build:
	npm run build

chat:
	npm run chat

diagnostic:
	npm run diagnostic

eval:
	npm run eval

test:
	npm test

check:
	npm run check

smoke-production:
	npm run smoke:production
