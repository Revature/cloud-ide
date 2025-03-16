# Revature Cloud Development Environment
## Backend

### Linting
This project uses *Ruff* for linting. Code will be checked automatically when pushed to any branch of the repo, and must meet a quality gate before being permitted to merge to a long-lived branch.

Linting can be checked on local development environments before pushing to a remote branch by first installing the *Ruff* linting tool to your local environment.
- In a terminal, use ``` pip install ruff ``` to install the tool globally, or to your virtual environment (remember to start your virtual environment **first** )  
- You can perform a linting check by using the option ```check``` in your terminal:  
```ruff check <path>```  
- You can perform an automatic formatting with the ```format``` option:  
```ruff format <path>```  
- Remember that you can save your linting report by output redirection to ```<report>-report.txt```, and it will be ignored from the git repository:  
```ruff check ./app >> ruff-feat-linting-report.txt```
