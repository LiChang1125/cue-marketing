import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('localization', Path(__file__).parents[1] / 'scripts/localize-public-data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LocalizationTests(unittest.TestCase):
    def test_translate_display_only_and_reuse_cache(self):
        item = {'title': 'Brand launches a new fragrance campaign', 'excerpt': 'The retailer introduces a new experience.', 'url': 'https://example.com/english-original', 'publishedAt': '2026-11-16T00:00:00Z'}
        data = {'feed': {'items': [item], 'editorial': [copy.deepcopy(item)]}, 'reports': {'reports': [{'entries': [copy.deepcopy(item)]}]}}
        calls = []
        def translate(texts):
            calls.append(texts)
            return ['品牌推出新的香水营销活动' if 'campaign' in t else '这家零售商推出全新体验。' for t in texts]
        module.localize(data, translate)
        self.assertEqual(len(calls[0]), 2)
        self.assertEqual(data['reports']['reports'][0]['entries'][0]['title'], '品牌推出新的香水营销活动')
        self.assertEqual(item['url'], 'https://example.com/english-original')
        self.assertEqual(item['originalTitle'], calls[0][0])
        data['feed']['items'].append({'title': calls[0][0]})
        module.localize(data, lambda _: self.fail('Cached text was translated again'))
    def test_chinese_brand_names_are_not_retranslated(self):
        self.assertFalse(module.needs_translation('Nike 与迪士尼推出全新联名系列'))
        self.assertTrue(module.needs_translation('Retail brands rethink the customer experience'))
    def test_failed_translation_is_not_marked_complete(self):
        with self.assertRaises(ValueError):
            module.localize({'title': 'A new brand marketing campaign'}, lambda _: [''])

if __name__ == '__main__':
    unittest.main()
