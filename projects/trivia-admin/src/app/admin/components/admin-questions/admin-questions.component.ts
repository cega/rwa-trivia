import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';

import { PageEvent, MatCheckboxChange } from '@angular/material';
import { AppState, appState, getCategories, getTags } from '../../../store';
import {
  User, Question, Category, SearchResults,
  SearchCriteria, ApplicationSettings, QuestionStatus
} from 'shared-library/shared/model';

import { adminState } from '../../store';
import * as adminActions from '../../store/actions';
import * as bulkActions from '../../../bulk/store/actions';
import { Router } from '@angular/router';
import { UserActions } from 'shared-library/core/store';
import { MatTabChangeEvent } from '@angular/material';

@Component({
  selector: 'admin-questions',
  templateUrl: './admin-questions.component.html',
  styleUrls: ['./admin-questions.component.scss']
})

export class AdminQuestionsComponent implements OnInit {
  questionsSearchResultsObs: Observable<SearchResults>;
  unpublishedQuestionsObs: Observable<Question[]>;
  categoryDictObs: Observable<{ [key: number]: Category }>;
  criteria: SearchCriteria;
  toggleValue: boolean;
  userDict$: Observable<{ [key: string]: User }>;
  userDict: { [key: string]: User } = {};
  selectedTab = 0;
  user: User;
  tagsObs: Observable<string[]>;
  categoriesObs: Observable<Category[]>;
  filteredStatus: Array<QuestionStatus>;
  APPROVED = QuestionStatus.APPROVED;
  INACTIVE = QuestionStatus.INACTIVE;
  PENDING = QuestionStatus.PENDING;
  REJECTED = QuestionStatus.REJECTED;
  REQUIRED_CHANGE = QuestionStatus.REQUIRED_CHANGE;
  applicationSettings: ApplicationSettings;
  quillConfig = {
    toolbar: {
      container: [],
      handlers: {
        // handlers object will be merged with default handlers object
        'mathEditor': () => {
        }
      }
    },
    mathEditor: {},
    blotFormatter: {},
    syntax: true
  };

  constructor(private store: Store<AppState>,
    private router: Router,
    private userActions: UserActions) {

    this.store.select(appState.coreState).pipe(select(s => s.applicationSettings)).subscribe(appSettings => {
      if (appSettings) {
        this.applicationSettings = appSettings[0];
        this.quillConfig.toolbar.container.push(this.applicationSettings.quill_options.options);
        this.quillConfig.toolbar.container.push(this.applicationSettings.quill_options.list);
        this.quillConfig.mathEditor = { mathOptions: this.applicationSettings };
      }
    });

    this.questionsSearchResultsObs = this.store.select(adminState).pipe(select(s => s.questionsSearchResults));
    this.unpublishedQuestionsObs = this.store.select(adminState).pipe(select(s => s.unpublishedQuestions), map((question) => {
      const questionList = question;
      if (questionList) {
        questionList.map((q) => {
          if (this.userDict[q.created_uid] === undefined) {
            this.store.dispatch(this.userActions.loadOtherUserProfile(q.created_uid));
          }
        });
      }

      return questionList;
    }));

    this.userDict$ = store.select(appState.coreState).pipe(select(s => s.userDict));
    this.userDict$.subscribe(userDict => this.userDict = userDict);


    this.categoryDictObs = store.select(appState.coreState).pipe(select(s => s.categories));
    this.criteria = new SearchCriteria();

    const url = this.router.url;
    this.toggleValue = url.includes('bulk') ? true : false;

    this.store.select(adminState).pipe(select(s => s.getQuestionToggleState)).subscribe((stat) => {
      if (stat != null) {
        this.selectedTab = stat === 'Published' ? 0 : 1;
      }
    });
    this.store.select(adminState).pipe(select(s => s.getArchiveToggleState)).subscribe((state) => {
      if (state != null) {
        this.toggleValue = state;
        (this.toggleValue) ? this.router.navigate(['admin/questions/bulk-questions']) : this.router.navigate(['/admin/questions']);
      } else {
        this.toggleValue = false;
        this.router.navigate(['/admin/questions']);
      }
    });

    this.categoriesObs = store.select(getCategories);
    this.tagsObs = this.store.select(getTags);

    this.filteredStatus = [];
    this.filteredStatus.push(this.PENDING);
  }

  ngOnInit() {
    this.store.select(appState.coreState).pipe(take(1)).subscribe(s => this.user = s.user);
  }

  approveQuestion(question: Question) {
    question.approved_uid = this.user.userId;
    this.store.dispatch(new adminActions.ApproveQuestion({ question: question }));
    this.store.dispatch(new adminActions.LoadUnpublishedQuestions(
      { 'question_flag': this.toggleValue, 'filteredStatus': this.filteredStatus }));

  }

  pageChanged(pageEvent: PageEvent) {
    const startRow = (pageEvent.pageIndex) * pageEvent.pageSize;

    this.store.dispatch(new adminActions.LoadQuestions({
      'startRow': startRow,
      'pageSize': pageEvent.pageSize, criteria: this.criteria
    }));
  }

  categoryChanged(event: { categoryId: number, added: boolean }) {
    if (!this.criteria.categoryIds) {
      this.criteria.categoryIds = [];
    }

    if (event.added) {
      this.criteria.categoryIds.push(event.categoryId);
    } else {
      this.criteria.categoryIds = this.criteria.categoryIds.filter(c => c !== event.categoryId);
    }

    this.searchCriteriaChange();
  }
  tagChanged(event: { tag: string, added: boolean }) {
    if (!this.criteria.tags) {
      this.criteria.tags = [];
    }

    if (event.added) {
      this.criteria.tags.push(event.tag);
    } else {
      this.criteria.tags = this.criteria.tags.filter(c => c !== event.tag);
    }

    this.searchCriteriaChange();
  }
  sortOrderChanged(sortOrder: string) {
    this.criteria.sortOrder = sortOrder;
    this.searchCriteriaChange();
  }
  searchCriteriaChange() {
    this.store.dispatch(new adminActions.LoadQuestions({ 'startRow': 0, 'pageSize': 25, criteria: this.criteria }));
  }

  tapped(value) {
    this.store.dispatch(new adminActions.SaveArchiveToggleState({ toggle_state: value }));
    this.toggleValue = value;
    (this.toggleValue) ? this.router.navigate(['admin/questions/bulk-questions']) : this.router.navigate(['/admin/questions']);
  }

  applyFilter(status: QuestionStatus, event: MatCheckboxChange) {
    if (event.checked) {
      this.filteredStatus.push(status);
    } else {
      this.filteredStatus.splice(this.filteredStatus.indexOf(status), 1);
    }
    this.store.dispatch(new adminActions.LoadUnpublishedQuestions(
      { 'question_flag': this.toggleValue, 'filteredStatus': this.filteredStatus }));
  }

  tabChanged = (tabChangeEvent: MatTabChangeEvent): void => {
    this.store.dispatch(new adminActions.SaveQuestionToggleState
      ({ toggle_state: tabChangeEvent.index === 0 ? 'Published' : 'Unpublished' }));
  }

  approveUnpublishedQuestions(question: Question) {
    this.store.dispatch(new bulkActions.ApproveQuestion({ question: question }));
  }

  updateUnpublishedQuestions(question: Question) {
    this.store.dispatch(new bulkActions.UpdateQuestion({ question: question }));
  }


}
