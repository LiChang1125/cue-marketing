import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('localization', Path(__file__).parents[1] / 'scripts/localize-public-data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LocalizationTests(unittest.TestCase):
    def test_brand_post_keeps_chinese_title_and_verbatim_caption(self):
        post = {'kind':'brand-post', 'platform':'Instagram', 'title':'跑鞋新配色',
                'originalTitle':'17 colorways. One new GEL-NIMBUS.'}
        module.localize(post, lambda _: self.fail('Caption must stay separate from the title'))
        self.assertEqual(post['title'], '跑鞋新配色')

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
        self.assertTrue(module.needs_translation('To Summer (观夏) introduces a new fragrance campaign and a book about the local culture of Yunnan 云南.'))
        self.assertFalse(module.needs_translation('文章链接：https://github.com/example/project 评论链接：https://news.ycombinator.com/item?id=123 内容中文'))
    def test_failed_translation_is_not_marked_complete(self):
        with self.assertRaises(ValueError):
            module.localize({'title': 'A new brand marketing campaign'}, lambda _: [''])
    def test_reviewed_headlines_replace_old_machine_copy(self):
        original = 'A new brand marketing campaign'
        data = {'title':'旧的机器译文','originalTitle':original,'translation':{'method':'older-model'}}
        module.localize(data, lambda _: self.fail('Reviewed title must not call translator'), {original:'品牌推出全新营销活动'})
        self.assertEqual(data['title'],'品牌推出全新营销活动')
        self.assertEqual(data['originalTitle'],original)

    def test_review_overrides_current_model_translation(self):
        original = 'Brand launches a new fragrance campaign'
        data = {'title': '当前机器译文', 'originalTitle': original, 'translation': {'method': module.MODEL_VERSION}}
        module.localize(data, lambda _: self.fail('Reviewed title must not call translator'), {original: '品牌推出香水营销活动'})
        self.assertEqual(data['title'], '品牌推出香水营销活动')
        self.assertEqual(data['originalTitle'], original)

if __name__ == '__main__':
    unittest.main()
