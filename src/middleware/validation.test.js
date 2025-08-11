const Joi = require('joi');
const { 
  userSchemas, 
  workoutSchemas, 
  exerciseSchemas, 
  paramSchemas, 
  querySchemas, 
  validate 
} = require('./validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('userSchemas', () => {
    describe('register schema', () => {
      test('should validate valid registration data', () => {
        const validData = {
          username: 'testuser123',
          email: 'test@example.com',
          password: 'password123'
        };

        const { error, value } = userSchemas.register.validate(validData);
        
        expect(error).toBeUndefined();
        expect(value).toEqual(validData);
      });

      test('should reject invalid username patterns', () => {
        const invalidUsernames = [
          'ab', // too short
          'a'.repeat(31), // too long
          'user@name', // invalid character
          'user name', // space
          'user-name' // hyphen
        ];

        invalidUsernames.forEach(username => {
          const { error } = userSchemas.register.validate({
            username,
            email: 'test@example.com',
            password: 'password123'
          });
          
          expect(error).toBeDefined();
          expect(error.details[0].path).toContain('username');
        });
      });

      test('should reject invalid email formats', () => {
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'test@',
          'test.example.com',
          'test@.com'
        ];

        invalidEmails.forEach(email => {
          const { error } = userSchemas.register.validate({
            username: 'testuser',
            email,
            password: 'password123'
          });
          
          expect(error).toBeDefined();
          expect(error.details[0].path).toContain('email');
        });
      });

      test('should reject short passwords', () => {
        const { error } = userSchemas.register.validate({
          username: 'testuser',
          email: 'test@example.com',
          password: '12345' // too short
        });
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('password');
        expect(error.details[0].message).toContain('at least 6 characters');
      });

      test('should require all fields', () => {
        const { error } = userSchemas.register.validate({});
        
        expect(error).toBeDefined();
        expect(error.details).toHaveLength(3);
        
        const missingFields = error.details.map(detail => detail.path[0]);
        expect(missingFields).toContain('username');
        expect(missingFields).toContain('email');
        expect(missingFields).toContain('password');
      });
    });

    describe('login schema', () => {
      test('should validate valid login data', () => {
        const validData = {
          username: 'testuser',
          password: 'password123'
        };

        const { error, value } = userSchemas.login.validate(validData);
        
        expect(error).toBeUndefined();
        expect(value).toEqual(validData);
      });

      test('should require username and password', () => {
        const { error } = userSchemas.login.validate({});
        
        expect(error).toBeDefined();
        expect(error.details).toHaveLength(2);
        
        const missingFields = error.details.map(detail => detail.path[0]);
        expect(missingFields).toContain('username');
        expect(missingFields).toContain('password');
      });
    });
  });

  describe('workoutSchemas', () => {
    describe('create schema', () => {
      test('should validate valid workout data', () => {
        const validData = {
          name: 'Morning Workout',
          description: 'A great morning routine',
          day: '2023-12-01',
          exercises: [
            {
              name: 'Push-ups',
              category: 'strength',
              sets: 3,
              reps: 10,
              duration: null,
              weight: null
            }
          ]
        };

        const { error, value } = workoutSchemas.create.validate(validData);
        
        expect(error).toBeUndefined();
        expect(value.exercises).toHaveLength(1);
      });

      test('should reject invalid exercise categories', () => {
        const invalidData = {
          name: 'Test Workout',
          day: '2023-12-01',
          exercises: [
            {
              name: 'Test Exercise',
              category: 'invalid_category',
              sets: 3,
              reps: 10
            }
          ]
        };

        const { error } = workoutSchemas.create.validate(invalidData);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('exercises');
        expect(error.details[0].path).toContain('category');
      });

      test('should require at least one exercise', () => {
        const invalidData = {
          name: 'Test Workout',
          day: '2023-12-01',
          exercises: []
        };

        const { error } = workoutSchemas.create.validate(invalidData);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('exercises');
        expect(error.details[0].message).toContain('at least one exercise');
      });

      test('should validate date format', () => {
        const invalidData = {
          name: 'Test Workout',
          day: 'invalid-date',
          exercises: [
            {
              name: 'Test Exercise',
              category: 'strength'
            }
          ]
        };

        const { error } = workoutSchemas.create.validate(invalidData);
        
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain('day');
      });
    });
  });

  describe('validate middleware', () => {
    test('should pass validation with valid data', () => {
      const middleware = validate(userSchemas.login);
      req.body = {
        username: 'testuser',
        password: 'password123'
      };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should call next with validation error for invalid data', () => {
      const middleware = validate(userSchemas.login);
      req.body = {
        username: 'ab', // too short
        password: '123' // too short
      };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].name).toBe('ValidationError');
      expect(next.mock.calls[0][0].details).toBeDefined();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    test('should validate params when source is params', () => {
      const middleware = validate(paramSchemas.id, 'params');
      req.params = { id: '123' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.params.id).toBe(123); // Should be converted to number
    });

    test('should validate query when source is query', () => {
      const middleware = validate(querySchemas.pagination, 'query');
      req.query = { page: '2', limit: '20' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.query.page).toBe(2); // Should be converted to number
      expect(req.query.limit).toBe(20); // Should be converted to number
    });

    test('should strip unknown fields', () => {
      const middleware = validate(userSchemas.login);
      req.body = {
        username: 'testuser',
        password: 'password123',
        unknownField: 'should be removed'
      };

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.unknownField).toBeUndefined();
    });

    test('should provide detailed error information', () => {
      const middleware = validate(userSchemas.register);
      req.body = {
        username: 'ab', // too short
        email: 'invalid-email',
        password: '123' // too short
      };

      middleware(req, res, next);

      const error = next.mock.calls[0][0];
      expect(error.details).toHaveLength(3);
      
      const fields = error.details.map(detail => detail.field);
      expect(fields).toContain('username');
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    });
  });

  describe('paramSchemas', () => {
    test('should validate numeric ID', () => {
      const { error, value } = paramSchemas.id.validate({ id: '123' });
      
      expect(error).toBeUndefined();
      expect(value.id).toBe(123);
    });

    test('should reject non-numeric ID', () => {
      const { error } = paramSchemas.id.validate({ id: 'abc' });
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('id');
    });

    test('should reject negative ID', () => {
      const { error } = paramSchemas.id.validate({ id: '-1' });
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('positive');
    });
  });

  describe('querySchemas', () => {
    test('should apply default values for pagination', () => {
      const { error, value } = querySchemas.pagination.validate({});
      
      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(10);
    });

    test('should validate date range format', () => {
      const validData = {
        startDate: '2023-12-01',
        endDate: '2023-12-31'
      };

      const { error, value } = querySchemas.dateRange.validate(validData);
      
      expect(error).toBeUndefined();
      expect(value).toEqual(validData);
    });

    test('should reject invalid date formats', () => {
      const invalidData = {
        startDate: '12/01/2023', // Wrong format
        endDate: '2023-12-31'
      };

      const { error } = querySchemas.dateRange.validate(invalidData);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('startDate');
    });
  });
});