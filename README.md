# @mininic-nt/lexical-freemarker

Lexical plugin utilities for working with Freemarker template syntax.

## Install

```bash
npm i @mininic-nt/lexical-freemarker
```

## Usage

```ts
import { FreemarkerTemplatePlugin } from '@mininic-nt/lexical-freemarker';

const plugin = new FreemarkerTemplatePlugin({
  onTokens(tokens) {
    console.log(tokens);
  },
});

plugin.parse('Hello ${user.name} <#if paid>Thanks</#if>');
```

## Development

```bash
npm install
npm run build
```

## Notes

This is an initial scaffold focused on typed tokenization and extension points.
Next step is binding parser behavior to Lexical editor commands/transforms.
