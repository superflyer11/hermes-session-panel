import unittest

from plugin_api import parse_numstat, parse_status


class ParseTests(unittest.TestCase):
    def test_status_kinds_and_rename(self):
        text = ' M a.py\0?? new.txt\0R  b.py\0old_b.py\0 D gone.md\0'
        self.assertEqual(parse_status(text), [
            {'path': 'a.py', 'status': 'modified'},
            {'path': 'new.txt', 'status': 'untracked'},
            {'path': 'b.py', 'status': 'renamed'},
            {'path': 'gone.md', 'status': 'deleted'}])

    def test_numstat_binary(self):
        self.assertEqual(parse_numstat('3\t1\ta.py\n-\t-\timg.png\n'), {'a.py': (3, 1), 'img.png': (0, 0)})


if __name__ == '__main__':
    unittest.main()
