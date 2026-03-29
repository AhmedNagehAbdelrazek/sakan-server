const { sequelize, Property, Application, Payment } = require('../../Models');

afterAll(async () => {
  await sequelize.close();
});

describe('Model associations', () => {
  test('Property has many Applications', () => {
    expect(Property.associations).toBeDefined();
    // Sequelize default aliasing uses pluralized model name
    expect(Property.associations.Applications).toBeDefined();
    expect(Property.associations.Applications.associationType).toBe('HasMany');
  });

  test('Application has many Payments and Payment belongs to Application', () => {
    expect(Application.associations.Payments).toBeDefined();
    expect(Application.associations.Payments.associationType).toBe('HasMany');

    expect(Payment.associations.Application).toBeDefined();
    expect(Payment.associations.Application.associationType).toBe('BelongsTo');
  });
});
