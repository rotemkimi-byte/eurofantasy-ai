name: EuroFantasy Auto Sync

on:
  workflow_dispatch:
  schedule:
    - cron: "*/30 * * * *"

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Sync EuroFantasy data
        env:
          FANTASY_TOKEN: ${{ secrets.FANTASY_TOKEN }}
        run: python sync.py

      - name: Save updated data
        run: |
          git config user.name "eurofantasy-bot"
          git config user.email "actions@users.noreply.github.com"
          git add data/
          if git diff --cached --quiet; then
            echo "No new data"
          else
            git commit -m "Auto update EuroFantasy data"
            git push
          fi
