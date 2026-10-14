# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0

"""Run workbook validation without starting the web app or any services."""
import importlib.util
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

import pytest
from openpyxl import load_workbook

spec = importlib.util.spec_from_file_location(
    "excel_workbook", Path(__file__).resolve().parents[1] / "frogquiz/helpers/excel_workbook.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
parse_excel, excel_template = module.parse_excel, module.excel_template


def changed(cells):
    workbook = load_workbook(BytesIO(excel_template()))
    for key, value in cells.items():
        workbook.active[key] = value
    result = BytesIO()
    workbook.save(result)
    workbook.close()
    return result.getvalue()


def test_template_is_valid_and_carries_both_question_types():
    preview = parse_excel(excel_template())
    assert preview["errors"] == []
    assert [q["type"] for q in preview["questions"]] == ["single", "multiple"]
    assert [q["row"] for q in preview["questions"]] == [14, 15]
    assert [a["right"] for a in preview["questions"][1]["answers"]] == [True, False, True, False]


@pytest.mark.parametrize("timer", [None, 0, -1, 121, 1.5, "no", True, "=10+10"])
def test_invalid_timers_are_row_errors_not_truncated(timer):
    errors = parse_excel(changed({"G14": timer}))["errors"]
    assert any(e["row"] == 14 and e["column"] == "Time" for e in errors)


@pytest.mark.parametrize("correct", [None, "13", "0", "5", "1;3", "1,4"])
def test_correct_answers_must_point_at_nonempty_answers(correct):
    errors = parse_excel(changed({"H14": correct}))["errors"]
    assert any(e["row"] == 14 and e["column"] == "Correct answers" for e in errors)


def test_blank_description_is_allowed_and_numeric_correct_answers_work():
    preview = parse_excel(changed({"C6": None, "H14": 1}))
    assert preview["description"] == ""
    assert preview["errors"] == []


def test_one_answer_and_missing_question_are_reported():
    errors = parse_excel(changed({"B14": None, "D14": None, "E14": None}))["errors"]
    assert {e["column"] for e in errors if e["row"] == 14} == {"Question", "Answers"}


@pytest.mark.parametrize("cell,limit", [("C5", 100), ("C6", 500), ("B14", 250), ("C14", 100)])
def test_text_limits_are_checked_before_creation(cell, limit):
    assert parse_excel(changed({cell: "x" * (limit + 1)}))["errors"]


def test_formulas_are_not_evaluated_or_imported():
    assert any(e["column"] == "Title" for e in parse_excel(changed({"C5": "=1+2"}))["errors"])


def test_corrupt_and_oversize_files_return_file_errors():
    assert parse_excel(b"not a workbook")["errors"][0]["row"] is None
    assert parse_excel(b"x" * (module.MAX_FILE_BYTES + 1))["errors"]


def test_zip_expansion_is_bounded_before_openpyxl_reads_it():
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("large.xml", "x" * (module.MAX_EXPANDED_BYTES + 1))
    assert len(buffer.getvalue()) < module.MAX_FILE_BYTES
    assert "unpacked" in parse_excel(buffer.getvalue())["errors"][0]["message"]


def test_empty_workbook_and_extra_rows_are_rejected():
    changes = {f"{c}{r}": None for c in "BCDEFGH" for r in (14, 15)}
    assert parse_excel(changed(changes))["errors"]
    assert parse_excel(changed({"B64": "Extra question"}))["errors"]


def test_wider_exports_preserve_answer_positions():
    preview = parse_excel(
        changed(
            {
                "G13": "5th Answer",
                "H13": "6th Answer",
                "I13": "Time Limit (max. 120)",
                "J13": "Correct Answers",
                "G14": "London",
                "H14": "Dublin",
                "I14": 20,
                "J14": "1,6",
                "G15": "Paris",
                "H15": "Amsterdam",
                "I15": 30,
                "J15": "3,5",
            }
        )
    )
    assert preview["errors"] == []
    assert preview["questions"][0]["answers"][-1] == {"text": "Dublin", "right": True}


def test_reordered_answer_headings_are_rejected_instead_of_changing_the_answer_key():
    errors = parse_excel(changed({"C13": "2nd Answer", "D13": "1st Answer"}))["errors"]
    assert errors[0]["row"] == 13


@pytest.mark.parametrize("encoding", ["utf-8", "utf-16", "utf-32"])
def test_xml_entity_declarations_are_rejected_before_loading_the_workbook(encoding):
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("xl/workbook.xml", '<!DOCTYPE test [<!ENTITY x "text">]><test>&x;</test>'.encode(encoding))
    assert "XML declarations" in parse_excel(buffer.getvalue())["errors"][0]["message"]
