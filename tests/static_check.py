from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'index.html'

class Checker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.assets = []
        self.external = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('src', 'href'):
            value = attrs.get(key)
            if not value:
                continue
            if value.startswith(('http://', 'https://', '//')):
                self.external.append(value)
            elif not value.startswith(('#', 'data:', 'mailto:', 'tel:')):
                self.assets.append(value.split('?')[0])

parser = Checker()
parser.feed(HTML.read_text(encoding='utf-8'))

duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
missing = sorted({asset for asset in parser.assets if not (ROOT / asset).exists()})

assert not duplicates, f'Повторяющиеся HTML id: {duplicates}'
assert not missing, f'Не найдены локальные ресурсы: {missing}'
assert not parser.external, f'Обнаружены внешние зависимости: {parser.external}'

app_js = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
store_js = (ROOT / 'js' / 'store.js').read_text(encoding='utf-8')
assert "data-view=\"dashboard\"" in HTML.read_text(encoding='utf-8')
assert "localStorage" in store_js
assert "Core.normalizeStatus" in app_js
assert "data-status=\"${status}\"" in app_js
assert not re.search(r'Gree Pular|Тест Клиент|Бакыт Мастер|Айбек Менеджер', app_js), 'В рабочий код попали тестовые данные'
assert 'MASTER_PAYMENT' in (ROOT / 'js' / 'core.js').read_text(encoding='utf-8')
assert 'add-ad-expense' in app_js and 'add-campaign' not in app_js
assert 'data-action="reset-data"' not in app_js
assert 'name="email" type="email" value="${e(employee' not in app_js
assert '₽' not in HTML.read_text(encoding='utf-8') + app_js

print('✓ HTML-структура корректна')
print('✓ Все локальные ресурсы существуют')
print('✓ Внешних зависимостей нет')
print('✓ Демо-данных в рабочем коде нет')
