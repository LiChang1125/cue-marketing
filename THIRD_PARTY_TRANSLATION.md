# Offline translation model

CUE uses the unmodified Argos English–Chinese translation package, version 1.9.

- Original download: https://argos-net.com/v1/translate-en_zh-1_9.argosmodel
- Reproducible mirror: https://github.com/LiChang1125/cue-marketing/releases/tag/translation-model-en-zh-1.9
- SHA-256: `433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab`
- Argos project: https://github.com/argosopentech/argos-translate

The package's README credits Jörg Tiedemann and Santhosh Thottingal, “OPUS-MT — Building open translation services for the World”, Proceedings of the 22nd Annual Conference of the European Association for Machine Translation (EAMT), 2020, Lisbon, Portugal.

The original OPUS model from which this package is derived is licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). The mirrored archive, including its original README and attribution, is unchanged. It is a runtime dependency, not part of the browser bundle. CUE's translation integration runs CTranslate2 and SentencePiece locally on the publishing runner; article text is not sent to a translation API.
